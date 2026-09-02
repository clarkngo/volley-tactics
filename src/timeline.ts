import {
  PlayState,
  PlayerData,
  BallPathData,
  PlayerKeyframe,
  BallKeyframe,
  ActionPose,
  Vec3,
  EasingType,
  cubicBezier,
  lerpVec3,
  lerp,
  sampleKeyframes,
  generateId,
  BALL_PATH_COLORS,
} from './types';
import { applyEasing } from './easing';

export class Timeline {
  duration = 10;
  currentTime = 0;
  playing = false;
  speed = 1;
  easing: EasingType = 'power2.inOut';
  private lastTimestamp = 0;

  players: PlayerData[] = [];
  ballPaths: BallPathData[] = [];

  onTimeUpdate: ((time: number) => void) | null = null;
  onPlayStateChange: ((playing: boolean) => void) | null = null;

  addPlayer(team: 'A' | 'B', action: ActionPose, position: Vec3): PlayerData {
    const player: PlayerData = {
      id: generateId(),
      team,
      action,
      position: { ...position },
      keyframes: [{ time: 0, position: { ...position } }],
    };
    this.players.push(player);
    return player;
  }

  removePlayer(id: string): void {
    this.players = this.players.filter((p) => p.id !== id);
  }

  addPlayerKeyframe(id: string, time?: number): void {
    const player = this.players.find((p) => p.id === id);
    if (!player) return;
    const t = time ?? this.currentTime;
    player.keyframes = player.keyframes.filter((kf) => Math.abs(kf.time - t) > 0.05);
    player.keyframes.push({
      time: t,
      position: { ...player.position },
    });
    player.keyframes.sort((a, b) => a.time - b.time);
  }

  addBallPath(points: [Vec3, Vec3, Vec3, Vec3], label?: string): BallPathData {
    const idx = this.ballPaths.length;
    const path: BallPathData = {
      id: generateId(),
      label: label ?? `Ball ${idx + 1}`,
      color: BALL_PATH_COLORS[idx % BALL_PATH_COLORS.length],
      points: points.map((p) => ({ ...p })) as [Vec3, Vec3, Vec3, Vec3],
      keyframes: [{ time: 0, t: 0 }, { time: this.duration, t: 1 }],
    };
    this.ballPaths.push(path);
    return path;
  }

  removeBallPath(id: string): void {
    this.ballPaths = this.ballPaths.filter((p) => p.id !== id);
  }

  addBallKeyframe(pathId: string, time?: number): void {
    const path = this.ballPaths.find((p) => p.id === pathId);
    if (!path) return;
    const t = time ?? this.currentTime;
    const paramT = this.getBallParamAtTime(path, t);
    path.keyframes = path.keyframes.filter((kf) => Math.abs(kf.time - t) > 0.05);
    path.keyframes.push({ time: t, t: paramT });
    path.keyframes.sort((a, b) => a.time - b.time);
  }

  isPathActiveAtTime(path: BallPathData, time: number): boolean {
    if (path.keyframes.length === 0) return false;
    const sorted = [...path.keyframes].sort((a, b) => a.time - b.time);
    return time >= sorted[0].time && time <= sorted[sorted.length - 1].time;
  }

  play(): void {
    this.playing = true;
    this.lastTimestamp = performance.now();
    this.onPlayStateChange?.(true);
  }

  pause(): void {
    this.playing = false;
    this.onPlayStateChange?.(false);
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, time));
    this.onTimeUpdate?.(this.currentTime);
  }

  seekPercent(pct: number): void {
    this.seek((pct / 1000) * this.duration);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setEasing(easing: EasingType): void {
    this.easing = easing;
  }

  setDuration(d: number): void {
    this.duration = Math.max(1, Math.min(60, d));
    if (this.currentTime > this.duration) {
      this.seek(this.duration);
    }
  }

  tick(now: number): number {
    if (!this.playing) {
      this.lastTimestamp = now;
      return 0;
    }
    const delta = ((now - this.lastTimestamp) / 1000) * this.speed;
    this.lastTimestamp = now;
    let next = this.currentTime + delta;
    if (next >= this.duration) next = 0;
    this.currentTime = next;
    this.onTimeUpdate?.(this.currentTime);
    return delta;
  }

  private easedLocal(t: number): number {
    return applyEasing(t, this.easing);
  }

  getPlayerPositionAtTime(player: PlayerData, time: number): Vec3 {
    const kf = sampleKeyframes<PlayerKeyframe>(
      player.keyframes,
      time,
      (a, b, t) => ({
        time: lerp(a.time, b.time, this.easedLocal(t)),
        position: lerpVec3(a.position, b.position, this.easedLocal(t)),
      }),
    );
    if (kf) return kf.position;
    return player.position;
  }

  getBallParamAtTime(path: BallPathData, time: number): number {
    const kf = sampleKeyframes<BallKeyframe>(
      path.keyframes,
      time,
      (a, b, t) => ({
        time: lerp(a.time, b.time, this.easedLocal(t)),
        t: lerp(a.t, b.t, this.easedLocal(t)),
      }),
    );
    return kf ? kf.t : 0;
  }

  getBallPositionAtTime(path: BallPathData, time: number): Vec3 {
    const paramT = this.getBallParamAtTime(path, time);
    return cubicBezier(path.points[0], path.points[1], path.points[2], path.points[3], paramT);
  }

  toState(): PlayState {
    return {
      version: 1,
      duration: this.duration,
      easing: this.easing,
      players: JSON.parse(JSON.stringify(this.players)),
      ballPaths: JSON.parse(JSON.stringify(this.ballPaths)),
    };
  }

  loadState(state: PlayState): void {
    this.duration = state.duration;
    this.easing = state.easing ?? 'power2.inOut';
    this.players = JSON.parse(JSON.stringify(state.players));
    this.ballPaths = JSON.parse(JSON.stringify(state.ballPaths));
    this.players.forEach((p) => {
      if (!p.action && p.pose) p.action = p.pose;
      if (!p.action) p.action = 'receiver';
      delete p.pose;
      p.keyframes.forEach((kf) => {
        if ('pose' in kf) delete (kf as { pose?: unknown }).pose;
      });
    });
    this.ballPaths.forEach((p, i) => {
      if (!p.label) p.label = `Ball ${i + 1}`;
      if (!p.color) p.color = BALL_PATH_COLORS[i % BALL_PATH_COLORS.length];
    });
    this.seek(0);
  }
}
