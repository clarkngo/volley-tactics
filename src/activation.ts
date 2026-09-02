import { PlayerData, ActionPose, DisplayPose, Vec3, POSE_HEIGHT } from './types';

/** Horizontal distance (m) at which a player reacts to the ball. */
const ACTIVATE_RADIUS = 2.4;
/** Max ball height (m) to trigger a floor-player reaction. */
const ACTIVATE_MAX_HEIGHT = 5.5;
/** Blockers react when ball is this close to the net (|z|). */
const BLOCK_NET_Z = 2.0;

function horizDist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export interface PlayerLayout {
  id: string;
  position: Vec3;
}

/**
 * Decide which silhouette each player shows.
 * Default is `ready`; switches to their assigned action when they are
 * the closest player to an active ball within range.
 */
export function resolveDisplayPoses(
  players: PlayerData[],
  layouts: PlayerLayout[],
  ballPositions: Vec3[],
): Map<string, DisplayPose> {
  const result = new Map<string, DisplayPose>();
  for (const p of players) result.set(p.id, 'ready');

  if (ballPositions.length === 0) return result;

  for (const ball of ballPositions) {
    if (ball.y > ACTIVATE_MAX_HEIGHT) continue;

    let bestId: string | null = null;
    let bestDist = Infinity;

    for (const layout of layouts) {
      const player = players.find((p) => p.id === layout.id);
      if (!player) continue;

      const dist = horizDist(layout.position, ball);

      // Blockers also react when ball approaches the net near them
      const isBlocker = player.action === 'blocker';
      const nearNet = Math.abs(ball.z) < BLOCK_NET_Z && Math.abs(layout.position.z) < BLOCK_NET_Z + 1;
      const inRange = dist < ACTIVATE_RADIUS || (isBlocker && nearNet && dist < ACTIVATE_RADIUS + 1.5);

      if (inRange && dist < bestDist) {
        bestDist = dist;
        bestId = layout.id;
      }
    }

    if (bestId) {
      const player = players.find((p) => p.id === bestId)!;
      result.set(bestId, player.action);
    }
  }

  return result;
}

/** Jump height for the current display pose. */
export function resolveJumpY(
  displayPose: DisplayPose,
  keyframeY: number,
): number {
  if (displayPose === 'ready') return 0;
  if (displayPose === 'attacker' || displayPose === 'blocker') {
    return Math.max(keyframeY, POSE_HEIGHT[displayPose]);
  }
  return keyframeY;
}

export function isActionPose(pose: DisplayPose): pose is ActionPose {
  return pose !== 'ready';
}
