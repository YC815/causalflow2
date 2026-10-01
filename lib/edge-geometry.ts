/** 連線彎曲的幾何計算（flow 座標，純函式） */

export type Pt = { x: number; y: number };
export type Bend = { dx: number; dy: number };

export function midpoint(s: Pt, t: Pt): Pt {
  return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
}

export function bendPoint(s: Pt, t: Pt, bend: Bend): Pt {
  const m = midpoint(s, t);
  return { x: m.x + bend.dx, y: m.y + bend.dy };
}

export function bendFromPoint(s: Pt, t: Pt, p: Pt): Bend {
  const m = midpoint(s, t);
  return { dx: p.x - m.x, dy: p.y - m.y };
}

/** 二次貝茲；控制點取 2P − 中點，使曲線在 t=0.5 恰好經過 P */
export function bentEdgePath(
  s: Pt,
  t: Pt,
  bend: Bend,
): { path: string; point: Pt } {
  const point = bendPoint(s, t, bend);
  const m = midpoint(s, t);
  const c = { x: 2 * point.x - m.x, y: 2 * point.y - m.y };
  return { path: `M ${s.x},${s.y} Q ${c.x},${c.y} ${t.x},${t.y}`, point };
}
