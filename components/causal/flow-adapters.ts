import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type {
  CausalJsonDocument,
  CausalJsonEdge,
  CausalJsonNode,
} from "@/lib/causal-json";
import type { CausalEdgeData } from "./causal-edge";
import type { CausalNodeData } from "./causal-node";

function marker(polarity: CausalEdgeData["polarity"]) {
  const color =
    polarity === "negative"
      ? "var(--causal-edge-neg)"
      : "var(--causal-edge-pos)";
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
    data: { label: n.label },
  };
}

export function jsonEdgeToFlow(e: CausalJsonEdge): Edge<CausalEdgeData> {
  const bidirectional = e.direction === "bidirectional";
  const polarity = e.polarity;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: "causal",
    data: { bidirectional, polarity },
    markerEnd: marker(polarity),
    markerStart: bidirectional ? marker(polarity) : undefined,
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
    })),
    edges: edges.map((e) => {
      const data = e.data ?? {
        bidirectional: false,
        polarity: "positive" as const,
      };
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        direction: data.bidirectional ? "bidirectional" : "one-way",
        polarity: data.polarity,
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
    markerStart: defaults.bidirectional
      ? marker(defaults.polarity)
      : undefined,
  };
}

/** 在變更 data 後同步箭頭顏色與雙向標記 */
export function withMarkers(e: Edge<CausalEdgeData>): Edge<CausalEdgeData> {
  const d = e.data ?? {
    bidirectional: false,
    polarity: "positive" as const,
  };
  return {
    ...e,
    data: d,
    markerEnd: marker(d.polarity),
    markerStart: d.bidirectional ? marker(d.polarity) : undefined,
  };
}
