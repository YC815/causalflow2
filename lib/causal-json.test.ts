import { describe, expect, it } from "vitest";
import { flowToDocument, jsonEdgeToFlow } from "@/components/causal/flow-adapters";
import { parseCausalJson, stringifyCausalJson } from "./causal-json";

const base = (edge: Record<string, unknown>) =>
  JSON.stringify({
    causalflowVersion: 1,
    nodes: [
      { id: "a", label: "A", x: 0, y: 0 },
      { id: "b", label: "B", x: 1, y: 1 },
    ],
    edges: [{ id: "ab", source: "a", target: "b", polarity: "positive", ...edge }],
  });

describe("parseCausalJson direction", () => {
  it("accepts missing direction as one-way", () => {
    expect(parseCausalJson(base({})).edges[0].direction).toBe("one-way");
  });
  it("downgrades legacy bidirectional to one-way", () => {
    expect(parseCausalJson(base({ direction: "bidirectional" })).edges[0].direction).toBe("one-way");
  });
  it("rejects unknown direction values", () => {
    expect(() => parseCausalJson(base({ direction: "both" }))).toThrow();
  });
  it("round-trips with direction one-way", () => {
    const doc = parseCausalJson(base({ direction: "one-way" }));
    expect(parseCausalJson(stringifyCausalJson(doc))).toEqual(doc);
  });
});

describe("parseCausalJson bend/flipped", () => {
  const doc = (node: Record<string, unknown>, edge: Record<string, unknown>) =>
    JSON.stringify({
      causalflowVersion: 1,
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, ...node },
        { id: "b", label: "B", x: 1, y: 1 },
      ],
      edges: [{ id: "ab", source: "a", target: "b", polarity: "positive", ...edge }],
    });

  it("reads bend and flipped", () => {
    const d = parseCausalJson(doc({ flipped: true }, { bend: { dx: 1, dy: -2 } }));
    expect(d.nodes[0].flipped).toBe(true);
    expect(d.edges[0].bend).toEqual({ dx: 1, dy: -2 });
  });
  it("omits flipped when false and bend when absent", () => {
    const d = parseCausalJson(doc({ flipped: false }, {}));
    expect("flipped" in d.nodes[0]).toBe(false);
    expect("bend" in d.edges[0]).toBe(false);
  });
  it("rejects invalid bend and flipped", () => {
    expect(() => parseCausalJson(doc({}, { bend: { dx: "1", dy: 0 } }))).toThrow();
    expect(() => parseCausalJson(doc({}, { bend: [1, 2] }))).toThrow();
    expect(() => parseCausalJson(doc({ flipped: "yes" }, {}))).toThrow();
  });
});

describe("parseCausalJson sides", () => {
  it("keeps non-default sides", () => {
    const e = parseCausalJson(base({ sourceSide: "in", targetSide: "out" })).edges[0];
    expect(e.sourceSide).toBe("in");
    expect(e.targetSide).toBe("out");
  });
  it("drops default sides", () => {
    const e = parseCausalJson(base({ sourceSide: "out", targetSide: "in" })).edges[0];
    expect("sourceSide" in e).toBe(false);
    expect("targetSide" in e).toBe(false);
  });
  it("rejects invalid sides", () => {
    expect(() => parseCausalJson(base({ sourceSide: "left" }))).toThrow();
    expect(() => parseCausalJson(base({ targetSide: 1 }))).toThrow();
  });
});

describe("edge side adapters", () => {
  it("round-trips sides and omits defaults", () => {
    const flow = jsonEdgeToFlow({
      id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive", sourceSide: "in",
    });
    expect([flow.sourceHandle, flow.targetHandle]).toEqual(["in", "in"]);
    const plain = jsonEdgeToFlow({
      id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive",
    });
    expect([plain.sourceHandle, plain.targetHandle]).toEqual(["out", "in"]);
    const [e1] = flowToDocument([], [flow]).edges;
    expect(e1.sourceSide).toBe("in");
    expect("targetSide" in e1).toBe(false);
    const [e2] = flowToDocument([], [plain]).edges;
    expect("sourceSide" in e2).toBe(false);
    expect("targetSide" in e2).toBe(false);
  });
});
