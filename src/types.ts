/** Shared types for the volleyball tactical board. */

export type Team = 'A' | 'B';
/** Action performed when the ball arrives. */
export type ActionPose = 'receiver' | 'setter' | 'attacker' | 'blocker';
/** Visual silhouette — ready stance or an action form. */
export type DisplayPose = 'ready' | ActionPose;
/** @deprecated Use ActionPose — kept for migration */
export type Pose = ActionPose;
export type CameraPreset = 'top' | 'iso' | 'server' | 'free';
export type EasingType =
  | 'linear'
  | 'power2.inOut'
  | 'power3.out'
  | 'back.inOut'
  | 'elastic.out'
  | 'bounce.out';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerKeyframe {
  time: number;
  position: Vec3;
}

export interface PlayerData {
  id: string;
  team: Team;
  /** Movement this player performs when the ball reaches them. */
  action: ActionPose;
  position: Vec3;
  keyframes: PlayerKeyframe[];
  /** @deprecated migrated to `action` */
  pose?: ActionPose;
}

export interface BallKeyframe {
  time: number;
  /** Parametric position along the bezier curve (0–1). */
  t: number;
}

export interface BallPathData {
  id: string;
  label: string;
  color: number;
  /** Cubic bezier control points: start, cp1, cp2, end */
  points: [Vec3, Vec3, Vec3, Vec3];
  keyframes: BallKeyframe[];
}

export interface PlayState {
  version: 1;
  duration: number;
  easing: EasingType;
  players: PlayerData[];
  ballPaths: BallPathData[];
}

export const BALL_PATH_COLORS = [
  0x5ec8e8,
  0xffffff,
  0x7ec8ff,
  0xa8e0ff,
  0x4db8d8,
] as const;

export const TEAM_COLORS = {
  A: 0x6ec8ff,
  B: 0xff6b7a,
} as const;

/** Base vertical offset per action pose (jump height). */
export const POSE_HEIGHT: Record<ActionPose, number> = {
  setter: 0,
  receiver: 0,
  blocker: 0.6,
  attacker: 0.8,
};

export const POSE_SCALE: Record<DisplayPose, [number, number]> = {
  ready: [1.1, 1.9],
  receiver: [1.15, 1.85],
  setter: [1.1, 2.05],
  attacker: [1.2, 2.1],
  blocker: [1.15, 2.15],
};

/** Human-readable labels for UI. */
export const ACTION_LABELS: Record<ActionPose, string> = {
  setter: 'Set',
  attacker: 'Attack',
  receiver: 'Pass',
  blocker: 'Block',
};

/** @deprecated use ACTION_LABELS */
export const POSE_LABELS = ACTION_LABELS;

export const COURT = {
  LENGTH: 18,
  WIDTH: 9,
  ATTACK_LINE: 3,
  NET_HEIGHT: 2.43,
  ANTENNA_HEIGHT: 0.8,
  POST_RADIUS: 0.05,
} as const;

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/** Evaluate a cubic bezier at parameter t ∈ [0, 1]. */
export function cubicBezier(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  t: number,
): Vec3 {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    z: u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z,
  };
}

/** Interpolate between two keyframe arrays at a given time. */
export function sampleKeyframes<T extends { time: number }>(
  keyframes: T[],
  time: number,
  interpolate: (a: T, b: T, t: number) => T,
): T | null {
  if (keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0];
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) {
      const local = (time - sorted[i].time) / (sorted[i + 1].time - sorted[i].time);
      return interpolate(sorted[i], sorted[i + 1], local);
    }
  }
  return sorted[sorted.length - 1];
}
