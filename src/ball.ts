import * as THREE from 'three';
import { Vec3, cubicBezier } from './types';

export interface PathVisuals {
  group: THREE.Group;
  solidLine: THREE.Line;
  dashedLine: THREE.Line;
  apexMarker: THREE.Mesh;
  targetRing: THREE.Mesh;
  handles: THREE.Group;
}

function volleyballTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f5f0e8';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  const panels = ['#2563eb', '#f5f0e8', '#dc2626', '#f5f0e8', '#2563eb', '#f5f0e8'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = panels[i];
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size / 2 - 4, a, a + Math.PI / 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBall(_color = 0x5ec8e8): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 20, 20),
    new THREE.MeshStandardMaterial({
      map: volleyballTexture(),
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  ball.castShadow = false;
  ball.userData = { type: 'ball' };
  return ball;
}

function sampleCurve(
  points: [Vec3, Vec3, Vec3, Vec3],
  segments: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = cubicBezier(points[0], points[1], points[2], points[3], t);
    pts.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  return pts;
}

function findApex(points: [Vec3, Vec3, Vec3, Vec3]): Vec3 {
  let maxY = -Infinity;
  let apex = points[0];
  for (let i = 0; i <= 64; i++) {
    const p = cubicBezier(points[0], points[1], points[2], points[3], i / 64);
    if (p.y > maxY) { maxY = p.y; apex = p; }
  }
  return apex;
}

export function createPathVisuals(
  points: [Vec3, Vec3, Vec3, Vec3],
  color = 0x5ec8e8,
): PathVisuals {
  const group = new THREE.Group();
  group.userData = { type: 'pathVisuals' };

  const curvePts = sampleCurve(points, 64);

  const solidLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curvePts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  solidLine.userData = { type: 'trajectory' };
  group.add(solidLine);

  const dashedLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curvePts),
    new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.35,
    }),
  );
  dashedLine.computeLineDistances();
  group.add(dashedLine);

  const apex = findApex(points);
  const apexMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  apexMarker.position.set(apex.x, apex.y, apex.z);
  group.add(apexMarker);

  const end = points[3];
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.28, 24),
    new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.set(end.x, 0.04, end.z);
  group.add(targetRing);

  // Inner target dot
  const targetDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  targetDot.rotation.x = -Math.PI / 2;
  targetDot.position.set(end.x, 0.045, end.z);
  group.add(targetDot);

  const handles = createControlHandles(points, color);
  group.add(handles);

  return { group, solidLine, dashedLine, apexMarker, targetRing, handles };
}

export function updatePathVisuals(visuals: PathVisuals, points: [Vec3, Vec3, Vec3, Vec3]): void {
  const curvePts = sampleCurve(points, 64);
  visuals.solidLine.geometry.dispose();
  visuals.solidLine.geometry = new THREE.BufferGeometry().setFromPoints(curvePts);
  visuals.dashedLine.geometry.dispose();
  visuals.dashedLine.geometry = new THREE.BufferGeometry().setFromPoints(curvePts);
  visuals.dashedLine.computeLineDistances();

  const apex = findApex(points);
  visuals.apexMarker.position.set(apex.x, apex.y, apex.z);

  const end = points[3];
  visuals.targetRing.position.set(end.x, 0.04, end.z);

  syncControlHandles(visuals.handles, points);
  visuals.solidLine.userData.bezierPoints = points;
}

/** Update dashed portion to show only ahead of current ball t. */
export function updatePathProgress(visuals: PathVisuals, points: [Vec3, Vec3, Vec3, Vec3], t: number): void {
  const ahead: THREE.Vector3[] = [];
  const start = Math.floor(t * 64);
  for (let i = start; i <= 64; i++) {
    const p = cubicBezier(points[0], points[1], points[2], points[3], i / 64);
    ahead.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  if (ahead.length < 2) return;
  visuals.dashedLine.geometry.dispose();
  visuals.dashedLine.geometry = new THREE.BufferGeometry().setFromPoints(ahead);
  visuals.dashedLine.computeLineDistances();
}

function createControlHandles(points: [Vec3, Vec3, Vec3, Vec3], pathColor: number): THREE.Group {
  const group = new THREE.Group();
  group.userData = { type: 'controlHandles' };
  const colors = [pathColor, 0x5ec8e8, 0x5ec8e8, pathColor];

  points.forEach((p, i) => {
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.8 }),
    );
    handle.position.set(p.x, p.y, p.z);
    handle.userData = { type: 'controlPoint', index: i };
    group.add(handle);
  });

  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, p.z))),
    new THREE.LineBasicMaterial({ color: 0x5ec8e8, transparent: true, opacity: 0.2 }),
  );
  group.add(guide);
  return group;
}

function syncControlHandles(group: THREE.Group, points: [Vec3, Vec3, Vec3, Vec3]): void {
  group.children.forEach((child) => {
    if (child.userData.type === 'controlPoint') {
      const idx = child.userData.index as number;
      child.position.set(points[idx].x, points[idx].y, points[idx].z);
    }
  });
  const guide = group.children.find((c) => c instanceof THREE.Line && !c.userData.type) as THREE.Line;
  if (guide) {
    guide.geometry.dispose();
    guide.geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    );
  }
}

export function getBezierFromHandles(group: THREE.Group): [Vec3, Vec3, Vec3, Vec3] {
  const pts: Vec3[] = [];
  group.children
    .filter((c) => c.userData.type === 'controlPoint')
    .sort((a, b) => a.userData.index - b.userData.index)
    .forEach((c) => pts.push({ x: c.position.x, y: c.position.y, z: c.position.z }));
  return pts as [Vec3, Vec3, Vec3, Vec3];
}

export function setTrajectorySelected(visuals: PathVisuals, selected: boolean): void {
  const opacity = selected ? 1.0 : 0.5;
  (visuals.solidLine.material as THREE.LineBasicMaterial).opacity = opacity;
  visuals.handles.visible = selected;
}

/** White contact vector from player hands to ball. */
export function createContactLine(): THREE.Line {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
  );
  line.visible = false;
  line.name = 'contactLine';
  return line;
}

export function updateContactLine(
  line: THREE.Line,
  from: THREE.Vector3,
  to: THREE.Vector3,
  show: boolean,
): void {
  line.visible = show;
  if (!show) return;
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
}
