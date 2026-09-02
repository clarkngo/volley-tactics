import * as THREE from 'three';
import { DisplayPose, Team, POSE_SCALE } from './types';
import silhouettesUrl from './assets/silhouettes.jpg';

const textureCache = new Map<string, THREE.CanvasTexture>();

const SHEET_COLS = 5;
const SHEET_ROWS = 2;

/** Column index in the reference sheet (left → right). */
const POSE_COLUMN: Record<DisplayPose, number> = {
  ready: 0,
  receiver: 1,
  setter: 2,
  blocker: 3,
  attacker: 4,
};

const TEAM_ROW: Record<Team, number> = { A: 0, B: 1 };

const OUT_W = 200;
const OUT_H = 300;

let spritesReady = false;
let spritesReadyPromise: Promise<void> | null = null;

function cacheKey(team: Team, pose: DisplayPose): string {
  return `${team}_${pose}`;
}

function keyOutBackground(data: ImageData): void {
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;

    // Light gray gradient background and floor reflection
    if (sat < 40 && max > 145) {
      px[i + 3] = 0;
    } else if (r > 215 && g > 215 && b > 215) {
      px[i + 3] = 0;
    }
  }
}

function extractPoseTexture(
  sheet: HTMLImageElement,
  team: Team,
  pose: DisplayPose,
): THREE.CanvasTexture {
  const col = POSE_COLUMN[pose];
  const row = TEAM_ROW[team];

  const cellW = sheet.naturalWidth / SHEET_COLS;
  const cellH = sheet.naturalHeight / SHEET_ROWS;

  const sx = col * cellW + cellW * 0.08;
  const sy = row * cellH + cellH * 0.02;
  const sw = cellW * 0.84;
  const sh = cellH * 0.72;

  const canvas = document.createElement('canvas');
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

  const imageData = ctx.getImageData(0, 0, OUT_W, OUT_H);
  keyOutBackground(imageData);
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildTextureCache(sheet: HTMLImageElement): void {
  const teams: Team[] = ['A', 'B'];
  const poses: DisplayPose[] = ['ready', 'receiver', 'setter', 'blocker', 'attacker'];

  for (const team of teams) {
    for (const pose of poses) {
      textureCache.set(cacheKey(team, pose), extractPoseTexture(sheet, team, pose));
    }
  }
}

/** Load reference silhouette sheet and build per-pose textures. */
export function initSprites(): Promise<void> {
  if (spritesReady) return Promise.resolve();
  if (spritesReadyPromise) return spritesReadyPromise;

  spritesReadyPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      buildTextureCache(img);
      spritesReady = true;
      resolve();
    };
    img.onerror = () => reject(new Error('Failed to load silhouette sheet'));
    img.src = silhouettesUrl;
  });

  return spritesReadyPromise;
}

function getTexture(team: Team, pose: DisplayPose): THREE.CanvasTexture {
  const key = cacheKey(team, pose);
  const tex = textureCache.get(key);
  if (!tex) {
    throw new Error('Sprites not loaded — call initSprites() before creating players');
  }
  return tex;
}

function spriteY(jumpY: number): number {
  return 0.95 + jumpY;
}

function createBillboardMesh(tex: THREE.Texture, sx: number, sy: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.scale.set(sx, sy, 1);
  mesh.renderOrder = 1;
  return mesh;
}

function applyBillboardScale(group: THREE.Group, displayPose: DisplayPose): void {
  const [sx, sy] = POSE_SCALE[displayPose];
  for (const name of ['billboard', 'glow']) {
    const mesh = group.getObjectByName(name) as THREE.Mesh | undefined;
    if (!mesh) continue;
    const factor = name === 'glow' ? 1.12 : 1;
    mesh.scale.set(sx * factor, sy * factor, 1);
  }
}

function createDirectionalGizmo(): THREE.Group {
  const gizmo = new THREE.Group();
  gizmo.name = 'gizmo';
  gizmo.visible = false;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  gizmo.add(ring);

  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.12);
  arrowShape.lineTo(0.08, 0);
  arrowShape.lineTo(-0.08, 0);
  arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });

  for (let i = 0; i < 4; i++) {
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = (i * Math.PI) / 2;
    arrow.position.set(
      Math.sin((i * Math.PI) / 2) * 0.55,
      0.05,
      Math.cos((i * Math.PI) / 2) * 0.55,
    );
    gizmo.add(arrow);
  }
  return gizmo;
}

export function createPlayerBillboard(team: Team, displayPose: DisplayPose = 'ready'): THREE.Group {
  const group = new THREE.Group();
  const tex = getTexture(team, displayPose);
  const [sx, sy] = POSE_SCALE[displayPose];

  const orient = new THREE.Group();
  orient.name = 'orient';
  group.add(orient);

  const glowMesh = createBillboardMesh(tex, sx * 1.12, sy * 1.12, 0.22);
  glowMesh.position.y = spriteY(0);
  glowMesh.name = 'glow';
  orient.add(glowMesh);

  const billboard = createBillboardMesh(tex, sx, sy, 1);
  billboard.position.y = spriteY(0);
  billboard.name = 'billboard';
  orient.add(billboard);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 32),
    new THREE.MeshBasicMaterial({
      color: team === 'A' ? 0x003399 : 0xe31b23,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  group.add(disc);

  group.add(createDirectionalGizmo());
  group.userData = { team, displayPose, type: 'player' };
  return group;
}

/** Keep silhouettes upright and facing the camera on the horizontal plane. */
export function updateBillboardFacing(group: THREE.Group, camera: THREE.Camera): void {
  const orient = group.getObjectByName('orient') as THREE.Group | undefined;
  if (!orient) return;

  const worldPos = new THREE.Vector3();
  group.getWorldPosition(worldPos);

  const dx = camera.position.x - worldPos.x;
  const dz = camera.position.z - worldPos.z;
  if (dx * dx + dz * dz < 1e-6) return;

  orient.rotation.set(0, Math.atan2(dx, dz), 0);
}

export function updateBillboardPose(group: THREE.Group, team: Team, displayPose: DisplayPose): void {
  const tex = getTexture(team, displayPose);

  for (const name of ['billboard', 'glow']) {
    const mesh = group.getObjectByName(name) as THREE.Mesh | undefined;
    if (!mesh) continue;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }
  applyBillboardScale(group, displayPose);
  group.userData.displayPose = displayPose;
}

export function setPlayerHeight(group: THREE.Group, jumpY: number, displayPose: DisplayPose): void {
  const y = spriteY(jumpY);
  applyBillboardScale(group, displayPose);
  for (const name of ['billboard', 'glow']) {
    const mesh = group.getObjectByName(name) as THREE.Mesh | undefined;
    if (!mesh) continue;
    mesh.position.y = y;
  }
}

export function setPlayerSelected(group: THREE.Group, selected: boolean): void {
  const gizmo = group.getObjectByName('gizmo');
  if (gizmo) gizmo.visible = selected;
}

export function createBlockZone(team: Team): THREE.Mesh {
  const color = team === 'A' ? 0x003399 : 0xe31b23;
  const zone = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.2, 0.15),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  zone.name = 'blockZone';
  zone.visible = false;
  return zone;
}

export function setBlockZoneVisible(group: THREE.Group, visible: boolean): void {
  const zone = group.getObjectByName('blockZone') as THREE.Mesh;
  if (zone) zone.visible = visible;
}

/** Clear texture cache (e.g. after hot reload). */
export function clearSpriteCache(): void {
  textureCache.forEach((t) => t.dispose());
  textureCache.clear();
  spritesReady = false;
  spritesReadyPromise = null;
}
