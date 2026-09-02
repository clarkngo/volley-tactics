import * as THREE from 'three';
import { COURT } from './types';

const CYAN = 0x5ec8e8;
const CYAN_GLOW = 0x3aa8cc;

/**
 * Builds the reference-style court: black void, glossy navy floor,
 * glowing cyan lines, translucent net with striped antennae.
 */
export function createCourt(): THREE.Group {
  const court = new THREE.Group();
  court.name = 'court';

  const halfL = COURT.LENGTH / 2;
  const halfW = COURT.WIDTH / 2;

  // Glossy dark navy floor
  const floorGeo = new THREE.PlaneGeometry(COURT.WIDTH, COURT.LENGTH);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0c1830,
    roughness: 0.25,
    metalness: 0.45,
    envMapIntensity: 0.5,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  court.add(floor);

  // Subtle floor sheen overlay
  const sheenGeo = new THREE.PlaneGeometry(COURT.WIDTH, COURT.LENGTH);
  const sheenMat = new THREE.MeshBasicMaterial({
    color: 0x1a3050,
    transparent: true,
    opacity: 0.12,
  });
  const sheen = new THREE.Mesh(sheenGeo, sheenMat);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.005;
  court.add(sheen);

  const glowLine = (pts: THREE.Vector3[]) => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.95,
    });
    court.add(new THREE.Line(geo, mat));
    // Under-glow duplicate (wider feel via second dimmer line at y+0.001)
    const glowMat = new THREE.LineBasicMaterial({
      color: CYAN_GLOW,
      transparent: true,
      opacity: 0.25,
    });
    const glowPts = pts.map((p) => new THREE.Vector3(p.x, 0.025, p.z));
    court.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(glowPts), glowMat));
  };

  // Boundary
  glowLine([
    new THREE.Vector3(-halfW, 0.02, -halfL),
    new THREE.Vector3(halfW, 0.02, -halfL),
    new THREE.Vector3(halfW, 0.02, halfL),
    new THREE.Vector3(-halfW, 0.02, halfL),
    new THREE.Vector3(-halfW, 0.02, -halfL),
  ]);

  // Center (net) line
  glowLine([
    new THREE.Vector3(-halfW, 0.02, 0),
    new THREE.Vector3(halfW, 0.02, 0),
  ]);

  // Attack lines
  const az = COURT.ATTACK_LINE;
  glowLine([
    new THREE.Vector3(-halfW, 0.02, -az),
    new THREE.Vector3(halfW, 0.02, -az),
  ]);
  glowLine([
    new THREE.Vector3(-halfW, 0.02, az),
    new THREE.Vector3(halfW, 0.02, az),
  ]);

  // ── Net ──────────────────────────────────────────────────────
  const netGroup = new THREE.Group();
  const netW = COURT.WIDTH + 0.15;
  const netH = COURT.NET_HEIGHT;

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(netW, netH, 18, 8), netMat);
  net.position.set(0, netH / 2, 0);
  netGroup.add(net);

  const netWire = new THREE.Mesh(
    new THREE.PlaneGeometry(netW, netH, 18, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    }),
  );
  netWire.position.set(0, netH / 2, 0);
  netGroup.add(netWire);

  // White top tape
  const tape = new THREE.Mesh(
    new THREE.BoxGeometry(netW, 0.04, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  tape.position.set(0, netH, 0);
  netGroup.add(tape);

  // Posts
  for (const x of [-halfW - 0.12, halfW + 0.12]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, netH + 0.2, 8),
      new THREE.MeshBasicMaterial({ color: 0x999999 }),
    );
    post.position.set(x, (netH + 0.2) / 2, 0);
    netGroup.add(post);
  }

  // Antennae
  const antH = COURT.ANTENNA_HEIGHT;
  for (const x of [-halfW, halfW]) {
    const ag = new THREE.Group();
    const segs = 8;
    const segH = antH / segs;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, segH, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff3333 : 0xffffff }),
      );
      seg.position.y = netH + segH / 2 + i * segH;
      ag.add(seg);
    }
    ag.position.set(x, 0, 0);
    netGroup.add(ag);
  }

  court.add(netGroup);
  return court;
}

export function clampToCourt(x: number, z: number): { x: number; z: number } {
  const halfW = COURT.WIDTH / 2 - 0.3;
  const halfL = COURT.LENGTH / 2 - 0.3;
  return {
    x: Math.max(-halfW, Math.min(halfW, x)),
    z: Math.max(-halfL, Math.min(halfL, z)),
  };
}
