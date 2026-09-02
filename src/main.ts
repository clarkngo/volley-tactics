import * as THREE from 'three';
import { createCourt } from './court';
import {
  initSprites,
  createPlayerBillboard,
  setPlayerSelected,
  updateBillboardPose,
  updateBillboardFacing,
  setPlayerHeight,
  createBlockZone,
  setBlockZoneVisible,
} from './sprites';
import {
  createBall,
  createPathVisuals,
  updatePathVisuals,
  updatePathProgress,
  getBezierFromHandles,
  setTrajectorySelected,
  createContactLine,
  updateContactLine,
  PathVisuals,
} from './ball';
import { resolveDisplayPoses, resolveJumpY } from './activation';
import { SceneControls } from './controls';
import { Timeline } from './timeline';
import { UI } from './ui';
import { decodeFromHash, importFromJson } from './state';
import { ActionPose, Vec3, DisplayPose, POSE_HEIGHT } from './types';

class App {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sceneControls: SceneControls;
  private timeline: Timeline;
  private ui: UI;

  private ballMeshes = new Map<string, THREE.Mesh>();
  private pathVisuals = new Map<string, PathVisuals>();
  private contactLine: THREE.Line;
  private selectedPlayerId: string | null = null;
  private selectedPathId: string | null = null;

  constructor() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(11, 9, 13);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(5, 12, 8);
    this.scene.add(key);

    this.scene.add(createCourt());
    this.contactLine = createContactLine();
    this.scene.add(this.contactLine);

    this.sceneControls = new SceneControls(canvas, this.camera);
    this.timeline = new Timeline();
    this.ui = new UI(this.timeline);

    this.wireEvents();
    this.loadFromHashOrDemo();
    this.sceneControls.setCameraPreset('iso');
    this.ui.renderKeyframeDots();
    this.animate();

    window.addEventListener('resize', this.onResize);
  }

  private wireEvents(): void {
    this.ui.onAddPlayer = (team, action) => this.addPlayer(team, action);
    this.ui.onAddBallPath = () => this.addBallPath();
    this.ui.onKeyframe = () => { this.addKeyframe(); this.ui.renderKeyframeDots(); };
    this.ui.onDelete = () => this.deleteSelected();
    this.ui.onActionChange = (action) => {
      if (this.selectedPlayerId) this.changeSelectedAction(action);
    };
    this.ui.onPositionChange = (x, z) => this.changeSelectedPosition(x, z);
    this.ui.onBallLabelChange = (label) => this.changeBallLabel(label);
    this.ui.onBallColorChange = (color) => this.changeBallColor(color);
    this.ui.onSeek = () => this.applyTimelineState();
    this.ui.onCameraPreset = (preset) =>
      this.sceneControls.setCameraPreset(preset as 'top' | 'iso' | 'server' | 'free');
    this.ui.onLoad = (json) => {
      this.timeline.loadState(importFromJson(json));
      this.rebuildScene();
      this.ui.renderKeyframeDots();
    };

    this.sceneControls.onPlayerDrag = (id, x, z) => {
      const player = this.timeline.players.find((p) => p.id === id);
      if (player) {
        player.position = { ...player.position, x, z };
        this.ui.showPlayerPanel(player.team, player.action, x, z);
      }
    };

    this.sceneControls.onControlPointDrag = (pathId) => {
      const visuals = this.pathVisuals.get(pathId);
      const path = this.timeline.ballPaths.find((p) => p.id === pathId);
      if (visuals && path) {
        path.points = getBezierFromHandles(visuals.handles);
        updatePathVisuals(visuals, path.points);
      }
    };

    this.sceneControls.onSelectBallPath = (pathId) => this.selectBallPath(pathId);

    this.sceneControls.onSelect = (obj) => {
      if (!obj) { this.deselectAll(); return; }
      let current: THREE.Object3D | null = obj;
      while (current) {
        if (current.userData.type === 'player') {
          const id = this.sceneControls.objectToPlayerId.get(current);
          if (id) this.selectPlayer(id);
          return;
        }
        if (current.userData.type === 'trajectory' && current.userData.pathId) {
          this.selectBallPath(current.userData.pathId);
          return;
        }
        current = current.parent;
      }
    };
  }

  private addPlayer(team: 'A' | 'B', action: ActionPose): void {
    const z = team === 'A' ? -4 : 4;
    const x = (Math.random() - 0.5) * 4;
    const player = this.timeline.addPlayer(team, action, { x, y: 0, z });
    const mesh = this.createPlayerMesh(team, action);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.sceneControls.playerMeshes.set(player.id, mesh);
    this.sceneControls.objectToPlayerId.set(mesh, player.id);
    this.selectPlayer(player.id);
  }

  private createPlayerMesh(team: 'A' | 'B', action: ActionPose): THREE.Group {
    const mesh = createPlayerBillboard(team, 'ready');
    mesh.userData.action = action;
    if (action === 'blocker') {
      const zone = createBlockZone(team);
      zone.position.set(0, 1.1, team === 'A' ? 0.5 : -0.5);
      mesh.add(zone);
    }
    return mesh;
  }

  private selectPlayer(id: string): void {
    this.deselectAll();
    this.selectedPlayerId = id;
    this.ui.setSelectedPlayerId(id);
    const mesh = this.sceneControls.playerMeshes.get(id);
    const player = this.timeline.players.find((p) => p.id === id);
    if (mesh && player) {
      setPlayerSelected(mesh, true);
      this.ui.showPlayerPanel(player.team, player.action, player.position.x, player.position.z);
    }
  }

  private selectBallPath(id: string): void {
    if (this.selectedPlayerId) {
      const m = this.sceneControls.playerMeshes.get(this.selectedPlayerId);
      if (m) setPlayerSelected(m, false);
    }
    this.selectedPlayerId = null;
    this.ui.setSelectedPlayerId(null);

    if (this.selectedPathId) {
      const prev = this.pathVisuals.get(this.selectedPathId);
      if (prev) setTrajectorySelected(prev, false);
    }

    this.selectedPathId = id;
    const path = this.timeline.ballPaths.find((p) => p.id === id);
    const visuals = this.pathVisuals.get(id);
    if (path && visuals) {
      setTrajectorySelected(visuals, true);
      this.ui.showBallPathPanel(path.label, path.color);
    }
  }

  private deselectAll(): void {
    if (this.selectedPlayerId) {
      const m = this.sceneControls.playerMeshes.get(this.selectedPlayerId);
      if (m) setPlayerSelected(m, false);
    }
    if (this.selectedPathId) {
      const v = this.pathVisuals.get(this.selectedPathId);
      if (v) setTrajectorySelected(v, false);
    }
    this.selectedPlayerId = null;
    this.selectedPathId = null;
    this.ui.hidePanel();
  }

  private changeSelectedAction(action: ActionPose): void {
    if (!this.selectedPlayerId) return;
    const player = this.timeline.players.find((p) => p.id === this.selectedPlayerId);
    const mesh = this.sceneControls.playerMeshes.get(this.selectedPlayerId);
    if (!player || !mesh) return;

    player.action = action;
    mesh.userData.action = action;

    // Rebuild block zone if needed
    const existingZone = mesh.getObjectByName('blockZone');
    if (existingZone) mesh.remove(existingZone);
    if (action === 'blocker') {
      const zone = createBlockZone(player.team);
      zone.position.set(0, 1.1, player.team === 'A' ? 0.5 : -0.5);
      mesh.add(zone);
    }

    this.applyTimelineState();
  }

  private changeSelectedPosition(x: number, z: number): void {
    if (!this.selectedPlayerId) return;
    const player = this.timeline.players.find((p) => p.id === this.selectedPlayerId);
    const mesh = this.sceneControls.playerMeshes.get(this.selectedPlayerId);
    if (player && mesh) {
      player.position = { ...player.position, x, z };
      mesh.position.set(x, 0, z);
    }
  }

  private changeBallLabel(label: string): void {
    const path = this.timeline.ballPaths.find((p) => p.id === this.selectedPathId);
    if (path) path.label = label;
  }

  private changeBallColor(color: number): void {
    const path = this.timeline.ballPaths.find((p) => p.id === this.selectedPathId);
    if (!path) return;
    path.color = color;
    const visuals = this.pathVisuals.get(path.id);
    if (visuals) {
      (visuals.solidLine.material as THREE.LineBasicMaterial).color.setHex(color);
      visuals.apexMarker.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    }
  }

  private deleteSelected(): void {
    if (this.selectedPlayerId) {
      const mesh = this.sceneControls.playerMeshes.get(this.selectedPlayerId);
      if (mesh) {
        this.scene.remove(mesh);
        this.sceneControls.playerMeshes.delete(this.selectedPlayerId);
        this.sceneControls.objectToPlayerId.delete(mesh);
      }
      this.timeline.removePlayer(this.selectedPlayerId);
      this.selectedPlayerId = null;
      this.ui.hidePanel();
      return;
    }
    if (this.selectedPathId) {
      this.removeBallPathVisuals(this.selectedPathId);
      this.timeline.removeBallPath(this.selectedPathId);
      this.selectedPathId = null;
      this.ui.hidePanel();
    }
  }

  private addBallPath(): void {
    const idx = this.timeline.ballPaths.length;
    const points: [Vec3, Vec3, Vec3, Vec3] = [
      { x: -0.5 + idx, y: 2.5, z: -6 },
      { x: 0 + idx, y: 5, z: -3 },
      { x: 0.5 + idx, y: 4, z: 1 },
      { x: 1 + idx, y: 0.8, z: 4 },
    ];
    const path = this.timeline.addBallPath(points);
    this.createBallPathVisuals(path);
    this.selectBallPath(path.id);
    this.applyTimelineState();
  }

  private createBallPathVisuals(path: { id: string; color: number; points: [Vec3, Vec3, Vec3, Vec3] }): void {
    const visuals = createPathVisuals(path.points, path.color);
    visuals.solidLine.userData.pathId = path.id;
    this.scene.add(visuals.group);
    this.pathVisuals.set(path.id, visuals);
    this.sceneControls.registerTrajectoryLine(path.id, visuals.solidLine);
    this.sceneControls.registerControlPoints(path.id, visuals.handles);

    const ball = createBall();
    ball.visible = false;
    this.scene.add(ball);
    this.ballMeshes.set(path.id, ball);
  }

  private removeBallPathVisuals(pathId: string): void {
    const visuals = this.pathVisuals.get(pathId);
    if (visuals) {
      this.scene.remove(visuals.group);
      this.pathVisuals.delete(pathId);
      this.sceneControls.trajectoryLines.delete(pathId);
      this.sceneControls.controlHandleGroups.delete(pathId);
    }
    const ball = this.ballMeshes.get(pathId);
    if (ball) { this.scene.remove(ball); this.ballMeshes.delete(pathId); }
  }

  private addKeyframe(): void {
    if (this.selectedPlayerId) this.timeline.addPlayerKeyframe(this.selectedPlayerId);
    if (this.selectedPathId) this.timeline.addBallKeyframe(this.selectedPathId);
    if (!this.selectedPlayerId && !this.selectedPathId) {
      this.timeline.players.forEach((p) => this.timeline.addPlayerKeyframe(p.id));
      this.timeline.ballPaths.forEach((p) => this.timeline.addBallKeyframe(p.id));
    }
  }

  private applyTimelineState(): void {
    const time = this.timeline.currentTime;
    const ballPositions: Vec3[] = [];
    let ballPos: THREE.Vector3 | null = null;
    let contactPlayer: THREE.Group | null = null;
    let contactDist = Infinity;

    // Collect active ball positions
    this.timeline.ballPaths.forEach((path) => {
      const ball = this.ballMeshes.get(path.id);
      const visuals = this.pathVisuals.get(path.id);
      if (!ball) return;

      const active = this.timeline.isPathActiveAtTime(path, time);
      ball.visible = active;
      if (active) {
        const pos = this.timeline.getBallPositionAtTime(path, time);
        ball.position.set(pos.x, pos.y, pos.z);
        ballPositions.push(pos);
        ballPos = ball.position;
        if (visuals) {
          updatePathProgress(visuals, path.points, this.timeline.getBallParamAtTime(path, time));
        }
      }
    });

    // Interpolate player positions
    const layouts = this.timeline.players.map((player) => {
      const pos = this.timeline.getPlayerPositionAtTime(player, time);
      player.position = pos;
      return { id: player.id, position: pos };
    });

    const displayPoses = resolveDisplayPoses(this.timeline.players, layouts, ballPositions);

    // Apply poses and positions to meshes
    this.timeline.players.forEach((player) => {
      const mesh = this.sceneControls.playerMeshes.get(player.id);
      if (!mesh) return;

      const layout = layouts.find((l) => l.id === player.id)!;
      mesh.position.set(layout.position.x, 0, layout.position.z);

      const displayPose: DisplayPose = displayPoses.get(player.id) ?? 'ready';
      if (mesh.userData.displayPose !== displayPose) {
        updateBillboardPose(mesh, player.team, displayPose);
      }

      const jumpY = resolveJumpY(displayPose, layout.position.y);
      setPlayerHeight(mesh, jumpY, displayPose);
      setBlockZoneVisible(mesh, displayPose === 'blocker');

      // Track contact for line
      if (ballPos && displayPose !== 'ready') {
        const dx = mesh.position.x - ballPos.x;
        const dz = mesh.position.z - ballPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < contactDist) {
          contactDist = dist;
          contactPlayer = mesh;
        }
      }
    });

    if (ballPos && contactPlayer && contactDist < 2.5) {
      const p = contactPlayer as THREE.Group;
      const pose = p.userData.displayPose as DisplayPose;
      const handY = pose === 'ready' ? 1.0 : (POSE_HEIGHT[pose as ActionPose] ?? 0) + 1.0;
      updateContactLine(
        this.contactLine,
        new THREE.Vector3(p.position.x, handY, p.position.z),
        ballPos,
        true,
      );
    } else {
      updateContactLine(this.contactLine, new THREE.Vector3(), new THREE.Vector3(), false);
    }
  }

  private rebuildScene(): void {
    this.sceneControls.playerMeshes.forEach((m) => this.scene.remove(m));
    this.sceneControls.playerMeshes.clear();
    this.sceneControls.objectToPlayerId.clear();
    this.pathVisuals.forEach((v) => this.scene.remove(v.group));
    this.pathVisuals.clear();
    this.sceneControls.trajectoryLines.clear();
    this.sceneControls.controlHandleGroups.clear();
    this.ballMeshes.forEach((b) => this.scene.remove(b));
    this.ballMeshes.clear();

    this.timeline.players.forEach((player) => {
      const mesh = this.createPlayerMesh(player.team, player.action);
      mesh.position.set(player.position.x, 0, player.position.z);
      this.scene.add(mesh);
      this.sceneControls.playerMeshes.set(player.id, mesh);
      this.sceneControls.objectToPlayerId.set(mesh, player.id);
    });
    this.timeline.ballPaths.forEach((path) => this.createBallPathVisuals(path));
    this.applyTimelineState();
  }

  private loadFromHashOrDemo(): void {
    const fromHash = decodeFromHash();
    if (fromHash) {
      this.timeline.loadState(fromHash);
      this.rebuildScene();
      return;
    }
    this.loadDemoPlay();
  }

  private loadDemoPlay(): void {
    this.timeline.duration = 8;
    this.timeline.setEasing('power3.out');

    const spawn = (team: 'A' | 'B', action: ActionPose, x: number, z: number) => {
      const player = this.timeline.addPlayer(team, action, { x, y: 0, z });
      const mesh = this.createPlayerMesh(team, action);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.sceneControls.playerMeshes.set(player.id, mesh);
      this.sceneControls.objectToPlayerId.set(mesh, player.id);
      return player;
    };

    const receiver = spawn('A', 'receiver', 2.5, -6.5);
    const setter = spawn('A', 'setter', -1, -3);
    const attacker = spawn('A', 'attacker', -2.5, -2.5);
    spawn('A', 'blocker', 3, -1);
    spawn('B', 'blocker', -0.5, 0.8);
    spawn('B', 'attacker', 2, 3);

    const pass = this.timeline.addBallPath([
      { x: 0, y: 3, z: -8 },
      { x: 1, y: 6, z: -5.5 },
      { x: 2, y: 3.5, z: -3 },
      { x: 2.5, y: 1.2, z: -6 },
    ], 'Pass');
    pass.keyframes = [{ time: 0, t: 0 }, { time: 2, t: 1 }];
    this.createBallPathVisuals(pass);

    const set = this.timeline.addBallPath([
      { x: 2.5, y: 1.2, z: -6 },
      { x: 0, y: 4.5, z: -3 },
      { x: -2, y: 5.5, z: -1 },
      { x: -2.5, y: 3.2, z: -2 },
    ], 'Set');
    set.keyframes = [{ time: 2, t: 0 }, { time: 4.5, t: 1 }];
    this.createBallPathVisuals(set);

    const spike = this.timeline.addBallPath([
      { x: -2.5, y: 3.2, z: -2 },
      { x: -2, y: 5, z: 0 },
      { x: 0, y: 3.5, z: 1 },
      { x: 1.5, y: 0.6, z: 2.5 },
    ], 'Attack');
    spike.keyframes = [{ time: 4.5, t: 0 }, { time: 6.5, t: 1 }];
    this.createBallPathVisuals(spike);

    receiver.keyframes = [
      { time: 0, position: { x: 2.5, y: 0, z: -6.5 } },
      { time: 1.5, position: { x: 2.5, y: 0, z: -6 } },
    ];
    setter.keyframes = [
      { time: 0, position: { x: -1, y: 0, z: -3 } },
      { time: 2, position: { x: 0.5, y: 0, z: -2.5 } },
      { time: 4, position: { x: 0, y: 0, z: -2 } },
    ];
    attacker.keyframes = [
      { time: 0, position: { x: -2.5, y: 0, z: -4 } },
      { time: 3.5, position: { x: -2.5, y: 0, z: -3 } },
      { time: 4.5, position: { x: -2, y: 0.8, z: -1.5 } },
      { time: 5.5, position: { x: -1.5, y: 0, z: -1 } },
    ];

    this.ui.renderKeyframeDots();
    this.applyTimelineState();
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.timeline.tick(performance.now());
    this.applyTimelineState();
    this.sceneControls.playerMeshes.forEach((mesh) => {
      updateBillboardFacing(mesh, this.camera);
    });
    this.sceneControls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.sceneControls.resize(window.innerWidth, window.innerHeight);
  };
}

initSprites().then(() => new App());
