import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraPreset } from './types';
import { clampToCourt } from './court';

/**
 * Camera preset positions and drag-to-move interaction
 * for players and ball control points on the court plane.
 */
export class SceneControls {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dragTarget: THREE.Object3D | null = null;
  private dragOffset = new THREE.Vector3();
  private dragMode: 'player' | 'controlPoint' | null = null;

  onPlayerDrag: ((id: string, x: number, z: number) => void) | null = null;
  onControlPointDrag: ((pathId: string, index: number, pos: THREE.Vector3) => void) | null = null;
  onSelect: ((object: THREE.Object3D | null) => void) | null = null;
  onSelectBallPath: ((pathId: string) => void) | null = null;

  // Map from Three.js object to entity id
  objectToPlayerId = new Map<THREE.Object3D, string>();
  objectToPathId = new Map<THREE.Object3D, string>();
  playerMeshes = new Map<string, THREE.Group>();
  controlHandleGroups = new Map<string, THREE.Group>();
  trajectoryLines = new Map<string, THREE.Line>();
  selectedObject: THREE.Object3D | null = null;

  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
    this.canvas = canvas;
    this.camera = camera;
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.target.set(0, 0, 0);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
  }

  update(): void {
    this.controls.update();
  }

  // ── Camera presets ───────────────────────────────────────────

  setCameraPreset(preset: CameraPreset): void {
    const duration = 800;
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    let endPos: THREE.Vector3;
    let endTarget = new THREE.Vector3(0, 0, 0);

    switch (preset) {
      case 'top':
        endPos = new THREE.Vector3(0, 22, 0.01);
        break;
      case 'iso':
        endPos = new THREE.Vector3(11, 9, 13);
        endTarget = new THREE.Vector3(0, 0.5, 0);
        break;
      case 'server':
        endPos = new THREE.Vector3(0, 3, -14);
        endTarget = new THREE.Vector3(0, 1.5, 0);
        break;
      case 'free':
        endPos = new THREE.Vector3(8, 8, 10);
        break;
    }

    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(startPos, endPos, ease);
      this.controls.target.lerpVectors(startTarget, endTarget, ease);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    if (preset === 'free') {
      this.controls.enableRotate = true;
    } else {
      this.controls.enableRotate = preset !== 'top';
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ── Raycasting helpers ───────────────────────────────────────

  private getIntersectObjects(): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    this.playerMeshes.forEach((mesh) => objects.push(mesh));
    this.controlHandleGroups.forEach((group) => objects.push(group));
    this.trajectoryLines.forEach((line) => objects.push(line));
    return objects;
  }

  private screenToNDC(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycast(e: PointerEvent): THREE.Intersection[] {
    this.screenToNDC(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.getIntersectObjects(), true);
  }

  // ── Pointer handlers ─────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    const hits = this.raycast(e);
    if (hits.length > 0) {
      let obj: THREE.Object3D = hits[0].object;
      // Walk up to find player group or control point
      while (obj.parent && !obj.userData.type) {
        obj = obj.parent;
      }

      if (obj.userData.type === 'player') {
        this.dragTarget = obj;
        this.dragMode = 'player';
        this.controls.enabled = false;
        this.selectObject(obj);
        const hitPoint = hits[0].point;
        this.dragOffset.copy(obj.position).sub(hitPoint);
        this.dragOffset.y = 0;
      } else if (obj.userData.type === 'controlPoint') {
        this.dragTarget = obj;
        this.dragMode = 'controlPoint';
        this.controls.enabled = false;
        const pathId = this.findPathIdForControlPoint(obj);
        if (pathId) this.onSelectBallPath?.(pathId);
      } else if (obj.userData.type === 'trajectory') {
        const pathId = obj.userData.pathId as string | undefined;
        if (pathId) this.onSelectBallPath?.(pathId);
      }
    } else {
      this.selectObject(null);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragTarget) return;

    this.screenToNDC(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) return;

    if (this.dragMode === 'player') {
      const clamped = clampToCourt(
        intersection.x + this.dragOffset.x,
        intersection.z + this.dragOffset.z,
      );
      this.dragTarget.position.set(clamped.x, 0, clamped.z);
      const playerId = this.objectToPlayerId.get(this.dragTarget);
      if (playerId) this.onPlayerDrag?.(playerId, clamped.x, clamped.z);
    } else if (this.dragMode === 'controlPoint') {
      this.dragTarget.position.set(intersection.x, Math.max(0.1, intersection.y), intersection.z);
      const pathId = this.findPathIdForControlPoint(this.dragTarget);
      if (pathId) {
        this.onControlPointDrag?.(
          pathId,
          this.dragTarget.userData.index,
          this.dragTarget.position.clone(),
        );
      }
    }
  };

  private onPointerUp = (): void => {
    this.dragTarget = null;
    this.dragMode = null;
    this.controls.enabled = true;
  };

  private selectObject(obj: THREE.Object3D | null): void {
    this.selectedObject = obj;
    this.onSelect?.(obj);
  }

  private findPathIdForControlPoint(obj: THREE.Object3D): string | undefined {
    let parent = obj.parent;
    while (parent) {
      if (parent.userData.pathId) return parent.userData.pathId;
      parent = parent.parent;
    }
    return this.objectToPathId.get(obj);
  }

  /** Register control point objects for a ball path. */
  registerControlPoints(pathId: string, handlesGroup: THREE.Group): void {
    handlesGroup.userData.pathId = pathId;
    this.controlHandleGroups.set(pathId, handlesGroup);
    handlesGroup.children.forEach((child) => {
      if (child.userData.type === 'controlPoint') {
        this.objectToPathId.set(child, pathId);
      }
    });
  }

  registerTrajectoryLine(pathId: string, line: THREE.Line): void {
    line.userData.pathId = pathId;
    this.trajectoryLines.set(pathId, line);
  }
}
