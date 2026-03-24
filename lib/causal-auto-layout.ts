import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";

/** 與節點卡片 min/max 寬度、padding 對齊的近似尺寸（供 dagre 排版） */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;

/**
 * 與節點連接點一致：LR＝左右 Handle；TB＝上下 Handle。
 */
export type CausalLayoutDirection = "LR" | "TB";

/** 以 dagre 做層級排版，回傳帶新 position 的節點。 */
export function layoutCausalNodes(
  nodes: Node<CausalNodeData>[],
  edges: Edge<CausalEdgeData>[],
  direction: CausalLayoutDirection = "LR",
): Node<CausalNodeData>[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: direction,
    ranksep: 72,
    nodesep: 48,
    marginx: 48,
    marginy: 48,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.source}\0${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id) as { x: number; y: number } | undefined;
    if (!pos) return n;
    return {
      ...n,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}
