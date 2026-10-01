import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

/** React Flow 尚未量測節點尺寸時的近似值 */
export const DEFAULT_NODE_SIZE = { width: 160, height: 60 };
const FLOW_GAP = 80;
const SIBLING_GAP = 40;
const NUDGE_STEP = 40;
const MAX_NUDGES = 50;

export function nodeRect(n: {
  position: Point;
  measured?: { width?: number; height?: number };
}): Rect {
  return {
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? DEFAULT_NODE_SIZE.width,
    height: n.measured?.height ?? DEFAULT_NODE_SIZE.height,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** 沿同層方向（LR 往下、TB 往右）推到不與任何節點重疊為止 */
function resolveOverlap(
  start: Point,
  others: Rect[],
  direction: CausalLayoutDirection,
): Point {
  let p = start;
  for (let i = 0; i < MAX_NUDGES; i += 1) {
    const rect = { ...p, ...DEFAULT_NODE_SIZE };
    if (!others.some((o) => rectsOverlap(rect, o))) return p;
    p =
      direction === "LR"
        ? { x: p.x, y: p.y + NUDGE_STEP }
        : { x: p.x + NUDGE_STEP, y: p.y };
  }
  return p;
}

export function downstreamPosition(
  from: Rect,
  direction: CausalLayoutDirection,
  others: Rect[],
  flipped = false,
): Point {
  // 翻轉後輸出在左／上側，新節點放在反方向；以預設尺寸估算新節點大小
  const base =
    direction === "LR"
      ? {
          x: flipped
            ? from.x - DEFAULT_NODE_SIZE.width - FLOW_GAP
            : from.x + from.width + FLOW_GAP,
          y: from.y,
        }
      : {
          x: from.x,
          y: flipped
            ? from.y - DEFAULT_NODE_SIZE.height - FLOW_GAP
            : from.y + from.height + FLOW_GAP,
        };
  return resolveOverlap(base, others, direction);
}

export function siblingPosition(
  of: Rect,
  direction: CausalLayoutDirection,
  others: Rect[],
): Point {
  const base =
    direction === "LR"
      ? { x: of.x, y: of.y + of.height + SIBLING_GAP }
      : { x: of.x + of.width + SIBLING_GAP, y: of.y };
  return resolveOverlap(base, others, direction);
}
