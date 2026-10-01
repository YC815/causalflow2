import { describe, expect, it } from "vitest";
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
