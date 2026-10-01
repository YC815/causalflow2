import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type {
  CausalJsonDocument,
  CausalJsonEdge,
  CausalJsonNode,
} from "@/lib/causal-json";
import type { CausalEdgeData } from "./causal-edge";
import type { CausalNodeData } from "./causal-node";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";

function marker(polarity: CausalEdgeData["polarity"]) {
  const color = CAUSAL_EDGE_STROKE_HEX[polarity];
  return {
    type: MarkerType.ArrowClosed as const,
    width: 22,
    height: 22,
    color,
  };
}

export function jsonNodeToFlow(n: CausalJsonNode): Node<CausalNodeData> {
  return {
    id: n.id,
    type: "causal",
    position: { x: n.x, y: n.y },
    data: { label: n.label, ...(n.flipped ? { flipped: true } : {}) },
  };
}

export function jsonEdgeToFlow(e: CausalJsonEdge): Edge<CausalEdgeData> {
  const polarity = e.polarity;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: "causal",
    data: { polarity, ...(e.bend ? { bend: e.bend } : {}) },
    markerEnd: marker(polarity),
  };
}

export function documentToFlow(doc: CausalJsonDocument): {
  nodes: Node<CausalNodeData>[];
  edges: Edge<CausalEdgeData>[];
} {
  return {
    nodes: doc.nodes.map(jsonNodeToFlow),
    edges: doc.edges.map(jsonEdgeToFlow),
  };
}

export function flowToDocument(
  nodes: Node<CausalNodeData>[],
  edges: Edge<CausalEdgeData>[],
  title?: string,
): CausalJsonDocument {
  return {
    causalflowVersion: 1,
    ...(title !== undefined && title !== "" ? { title } : {}),
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      x: n.position.x,
      y: n.position.y,
      ...(n.data.flipped ? { flipped: true as const } : {}),
    })),
    edges: edges.map((e) => {
      const data = e.data ?? { polarity: "positive" as const };
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        direction: "one-way" as const,
        polarity: data.polarity,
        ...(data.bend ? { bend: data.bend } : {}),
      };
    }),
  };
}

/** 新建連線時套用目前預設，並帶正確箭頭樣式 */
export function newFlowEdge(
  id: string,
  source: string,
  target: string,
  defaults: CausalEdgeData,
): Edge<CausalEdgeData> {
  return {
    id,
    source,
    target,
    type: "causal",
    data: { ...defaults },
    markerEnd: marker(defaults.polarity),
  };
}

/** 在變更 data 後同步箭頭顏色 */
export function withMarkers(e: Edge<CausalEdgeData>): Edge<CausalEdgeData> {
  const d = e.data ?? { polarity: "positive" as const };
  return {
    ...e,
    data: d,
    markerEnd: marker(d.polarity),
  };
}
