import type { Rect } from "@/lib/placement";

export type ArrowDirection = "up" | "down" | "left" | "right";

const UNIT: Record<ArrowDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** cos(60°)；浮點誤差容忍 */
const MIN_COS = 0.5 - 1e-9;

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** 在指定方向 60° 錐形內，取中心點距離最近的節點 */
export function findNeighbor(
  from: Rect,
  candidates: { id: string; rect: Rect }[],
  direction: ArrowDirection,
): string | null {
  const origin = center(from);
  const unit = UNIT[direction];
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const p = center(c.rect);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    if ((dx * unit.x + dy * unit.y) / dist < MIN_COS) continue;
    if (dist < bestDist) {
      best = c.id;
      bestDist = dist;
    }
  }
  return best;
}
