import type { Edge, Node } from "@xyflow/react";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import {
  flowToDocument,
  jsonEdgeToFlow,
  jsonNodeToFlow,
} from "@/components/causal/flow-adapters";
import type { CausalJsonDocument } from "@/lib/causal-json";
import type { Point } from "@/lib/placement";

export const PASTE_OFFSET = 24;

/** 選取的節點＋兩端都在選取內的連線；沒有選取節點時回 null */
export function extractFragment(
  nodes: Node<CausalNodeData>[],
  edges: Edge<CausalEdgeData>[],
): CausalJsonDocument | null {
  const picked = nodes.filter((n) => n.selected);
  if (picked.length === 0) return null;
  const ids = new Set(picked.map((n) => n.id));
  const inner = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return flowToDocument(picked, inner);
}

/** 片段轉成可插入畫布的新節點／連線（全部換新 id） */
export function instantiateFragment(
  doc: CausalJsonDocument,
  opts: { idSeed: string; anchor?: Point },
): { nodes: Node<CausalNodeData>[]; edges: Edge<CausalEdgeData>[] } {
  if (doc.nodes.length === 0) return { nodes: [], edges: [] };
  const minX = Math.min(...doc.nodes.map((n) => n.x));
  const minY = Math.min(...doc.nodes.map((n) => n.y));
  const dx = opts.anchor ? opts.anchor.x - minX : PASTE_OFFSET;
  const dy = opts.anchor ? opts.anchor.y - minY : PASTE_OFFSET;
  const idMap = new Map(
    doc.nodes.map((n, i) => [n.id, `n-${opts.idSeed}-${i}`] as const),
  );

  const nodes = doc.nodes.map((n) => ({
    ...jsonNodeToFlow({ ...n, id: idMap.get(n.id)!, x: n.x + dx, y: n.y + dy }),
    selected: true,
  }));
  const edges = doc.edges.flatMap((e, i) => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) return [];
    return [jsonEdgeToFlow({ ...e, id: `e-${source}-${target}-${i}`, source, target })];
  });
  return { nodes, edges };
}
