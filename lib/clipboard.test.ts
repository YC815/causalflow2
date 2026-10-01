import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import { documentToFlow } from "@/components/causal/flow-adapters";
import type { CausalJsonDocument } from "@/lib/causal-json";
import { PASTE_OFFSET, extractFragment, instantiateFragment } from "./clipboard";

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  nodes: [
    { id: "a", label: "A", x: 100, y: 100 },
    { id: "b", label: "B", x: 300, y: 100 },
    { id: "c", label: "C", x: 500, y: 100 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive" },
    { id: "bc", source: "b", target: "c", direction: "bidirectional", polarity: "negative" },
  ],
};

function flowWithSelected(ids: string[]) {
  const { nodes, edges } = documentToFlow(DOC);
  return {
    nodes: nodes.map((n) => ({ ...n, selected: ids.includes(n.id) })) as Node<CausalNodeData>[],
    edges: edges as Edge<CausalEdgeData>[],
  };
}

describe("extractFragment", () => {
  it("returns null without selected nodes", () => {
    const { nodes, edges } = flowWithSelected([]);
    expect(extractFragment(nodes, edges)).toBeNull();
  });

  it("keeps only edges with both ends selected", () => {
    const { nodes, edges } = flowWithSelected(["a", "b"]);
    const frag = extractFragment(nodes, edges)!;
    expect(frag.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(frag.edges.map((e) => e.id)).toEqual(["ab"]);
  });
});

describe("instantiateFragment", () => {
  it("assigns fresh ids, remaps edges, offsets and selects", () => {
    const { nodes, edges } = instantiateFragment(DOC, { idSeed: "s1" });
    expect(nodes.map((n) => n.id)).toEqual(["n-s1-0", "n-s1-1", "n-s1-2"]);
    expect(nodes.every((n) => n.selected)).toBe(true);
    expect(nodes[0].position).toEqual({ x: 100 + PASTE_OFFSET, y: 100 + PASTE_OFFSET });
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      ["n-s1-0", "n-s1-1"],
      ["n-s1-1", "n-s1-2"],
    ]);
    expect(edges[1].data).toEqual({ bidirectional: true, polarity: "negative" });
    expect(new Set(edges.map((e) => e.id)).size).toBe(2);
  });

  it("aligns the fragment's top-left to the anchor", () => {
    const { nodes } = instantiateFragment(DOC, { idSeed: "s2", anchor: { x: 0, y: 50 } });
    expect(nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
      { x: 400, y: 50 },
    ]);
  });

  it("returns nothing for an empty fragment", () => {
    const empty: CausalJsonDocument = { causalflowVersion: 1, nodes: [], edges: [] };
    expect(instantiateFragment(empty, { idSeed: "x" })).toEqual({ nodes: [], edges: [] });
  });
});
