import { beforeEach, describe, expect, it } from "vitest";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";
import type { CausalJsonDocument } from "@/lib/causal-json";
import { extractFragment } from "@/lib/clipboard";
import {
  DUPLICATE_EDGE_MESSAGE,
  NEW_NODE_LABEL,
  useCausalStore,
} from "./causal-store";

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "t",
  nodes: [
    { id: "a", label: "A", x: 0, y: 0 },
    { id: "b", label: "B", x: 200, y: 0 },
    { id: "c", label: "C", x: 400, y: 0 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive" },
  ],
};

const s = () => useCausalStore.getState();
const ids = () => s().nodes.map((n) => n.id);

beforeEach(() => {
  useCausalStore.setState(useCausalStore.getInitialState(), true);
  s().replaceDocument(DOC, "LR");
});

describe("causal store", () => {
  it("addNode selects the new node and is undoable/redoable", () => {
    const id = s().addNode({ x: 1, y: 2 });
    expect(ids()).toContain(id);
    expect(s().nodes.find((n) => n.id === id)?.data.label).toBe(NEW_NODE_LABEL);
    expect(s().nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([id]);
    s().undo();
    expect(ids()).not.toContain(id);
    s().redo();
    expect(ids()).toContain(id);
  });

  it("cancelling a new connected node removes it and its history entry", () => {
    const before = s().history.past.length;
    const id = s().addConnectedNode("a", { x: 0, y: 200 }, "downstream");
    expect(s().editing).toEqual({ id, isNew: true });
    expect(s().edges.some((e) => e.source === "a" && e.target === id)).toBe(true);
    s().finishEditing(null);
    expect(ids()).not.toContain(id);
    expect(s().edges).toHaveLength(1);
    expect(s().history.past.length).toBe(before);
    expect(s().editing).toBeNull();
  });

  it("upstream side creates an edge into the anchor", () => {
    const id = s().addConnectedNode("a", { x: -200, y: 0 }, "upstream");
    expect(s().edges.some((e) => e.source === id && e.target === "a")).toBe(true);
  });

  it("confirming a new node stores the trimmed label", () => {
    const id = s().addNode({ x: 0, y: 0 }, { edit: true });
    s().finishEditing("  X  ");
    expect(s().nodes.find((n) => n.id === id)?.data.label).toBe("X");
    expect(s().editing).toBeNull();
  });

  it("editing an existing node without change discards the commit", () => {
    const before = s().history.past.length;
    s().startEditing("a");
    expect(s().history.past.length).toBe(before + 1);
    s().finishEditing("A");
    expect(s().history.past.length).toBe(before);
  });

  it("editing an existing node to empty keeps the old label", () => {
    s().startEditing("a");
    s().finishEditing("   ");
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A");
  });

  it("editing an existing node is undoable", () => {
    s().startEditing("a");
    s().finishEditing("A2");
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A2");
    s().undo();
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A");
  });

  it("connect rejects duplicates with a toast", () => {
    expect(s().connect("a", "b")).toBe(false);
    expect(s().toast).toBe(DUPLICATE_EDGE_MESSAGE);
    expect(s().connect("b", "c")).toBe(true);
    expect(s().edges).toHaveLength(2);
  });

  it("reverseEdge swaps ends and refuses to create a duplicate", () => {
    expect(s().reverseEdge("ab")).toBe(true);
    const e = s().edges.find((x) => x.id === "ab")!;
    expect([e.source, e.target]).toEqual(["b", "a"]);
    expect(s().connect("a", "b")).toBe(true);
    const added = s().edges.find((x) => x.source === "a" && x.target === "b")!;
    expect(s().reverseEdge(added.id)).toBe(false);
  });

  it("updateEdge changes polarity and marker color", () => {
    s().updateEdge("ab", { polarity: "negative" });
    const e = s().edges.find((x) => x.id === "ab")!;
    expect(e.data?.polarity).toBe("negative");
    expect(e.markerEnd).toMatchObject({ color: CAUSAL_EDGE_STROKE_HEX.negative });
  });

  it("deleteSelected removes edges touching deleted nodes and is undoable", () => {
    s().selectNodes(["b"]);
    s().deleteSelected();
    expect(ids()).toEqual(["a", "c"]);
    expect(s().edges).toHaveLength(0);
    s().undo();
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(s().edges).toHaveLength(1);
  });

  it("deleteSelected with nothing selected does not record history", () => {
    const before = s().history.past.length;
    s().deleteSelected();
    expect(s().history.past.length).toBe(before);
  });

  it("pasteFragment adds selected copies with fresh ids", () => {
    s().selectNodes(["a", "b"]);
    const frag = extractFragment(s().nodes, s().edges)!;
    s().pasteFragment(frag);
    const selected = s().nodes.filter((n) => n.selected).map((n) => n.id);
    expect(s().nodes).toHaveLength(5);
    expect(selected).toHaveLength(2);
    expect(selected.some((id) => ["a", "b", "c"].includes(id))).toBe(false);
    expect(s().edges).toHaveLength(2);
  });

  it("undo of applyLayout restores direction and positions", () => {
    s().applyLayout("TB");
    expect(s().layoutDirection).toBe("TB");
    s().undo();
    expect(s().layoutDirection).toBe("LR");
    expect(s().nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 0 });
  });

  it("newBlank clears the document and is undoable", () => {
    s().newBlank();
    expect(s().nodes).toHaveLength(0);
    expect(s().title).toBe("");
    s().undo();
    expect(s().nodes).toHaveLength(3);
    expect(s().title).toBe("t");
  });

  it("snapshots never carry selection", () => {
    s().selectNodes(["a"]);
    s().commit();
    const snap = s().history.past.at(-1)!;
    expect(snap.nodes.some((n) => n.selected)).toBe(false);
  });

  it("cancelling an edit after undo keeps the redo stack", () => {
    s().addNode({ x: 5, y: 5 });
    const withNode = s().nodes.length;
    s().undo();
    s().startEditing("a");
    s().finishEditing("A");
    expect(s().history.future).toHaveLength(1);
    s().redo();
    expect(s().nodes).toHaveLength(withNode);
  });

  it("cancelling a new node after undo keeps the redo stack", () => {
    s().addNode({ x: 5, y: 5 });
    const withNode = s().nodes.length;
    s().undo();
    s().addNode({ x: 9, y: 9 }, { edit: true });
    s().finishEditing(null);
    s().redo();
    expect(s().nodes).toHaveLength(withNode);
  });

  it("deleting the node being edited clears editing", () => {
    const id = s().addNode({ x: 0, y: 0 }, { edit: true });
    s().selectNodes([id]);
    s().deleteSelected();
    expect(s().editing).toBeNull();
  });

  it("re-entrant startEditing on the node being edited is ignored", () => {
    const id = s().addNode({ x: 0, y: 0 }, { edit: true });
    const before = s().history.past.length;
    s().startEditing(id);
    expect(s().editing).toEqual({ id, isNew: true });
    expect(s().history.past.length).toBe(before);
    s().finishEditing(null);
    expect(s().nodes.some((n) => n.id === id)).toBe(false);
  });

  it("addNode without edit clears a previous editing state", () => {
    s().startEditing("a");
    s().addNode({ x: 0, y: 0 });
    expect(s().editing).toBeNull();
  });
});

describe("restoreLabel", () => {
  it("還原 label 並丟掉最新一筆歷史", () => {
    const before = s().history.past.length;
    s().commit();
    s().updateNodeLabel("a", "x");
    s().restoreLabel("a", "A");
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A");
    expect(s().history.past.length).toBe(before);
  });
});

describe("bend and flip", () => {
  it("setEdgeBend does not record history; resetEdgeBend does", () => {
    const before = s().history.past.length;
    s().setEdgeBend("ab", { dx: 5, dy: 6 });
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
    expect(s().history.past.length).toBe(before);
    s().resetEdgeBend("ab");
    expect(s().edges[0].data?.bend).toBeUndefined();
    expect(s().history.past.length).toBe(before + 1);
    s().undo();
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
  });
  it("resetEdgeBend without bend is a no-op", () => {
    const before = s().history.past.length;
    s().resetEdgeBend("ab");
    expect(s().history.past.length).toBe(before);
  });
  it("toggleFlip flips and is undoable", () => {
    s().toggleFlip(["a"]);
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
    s().toggleFlip(["a"]);
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBeUndefined();
    s().undo();
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
  });
  it("applyLayout clears bends but keeps flips", () => {
    s().setEdgeBend("ab", { dx: 5, dy: 6 });
    s().toggleFlip(["a"]);
    s().applyLayout("LR");
    expect(s().edges[0].data?.bend).toBeUndefined();
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
    s().undo();
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
  });
});
