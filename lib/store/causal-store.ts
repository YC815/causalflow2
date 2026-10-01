import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import {
  documentToFlow,
  newFlowEdge,
  withMarkers,
} from "@/components/causal/flow-adapters";
import {
  type CausalLayoutDirection,
  layoutCausalNodes,
} from "@/lib/causal-auto-layout";
import type { CausalJsonDocument, CausalPolarity } from "@/lib/causal-json";
import { instantiateFragment } from "@/lib/clipboard";
import {
  emptyHistory,
  type History,
  record,
  redo as redoHistory,
  undo as undoHistory,
} from "@/lib/store/history";

export type FlowNode = Node<CausalNodeData>;
export type FlowEdge = Edge<CausalEdgeData>;

/** undo 單位：不含 selection 與 viewport */
export type Snapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  title: string;
  layoutDirection: CausalLayoutDirection;
};

export type EditingState = { id: string; isNew: boolean } | null;

export const NEW_NODE_LABEL = "新節點";
export const DUPLICATE_EDGE_MESSAGE = "兩節點之間已有連線";
const TOAST_MS = 3200;

let seq = 0;
export function uid(): string {
  seq += 1;
  return `${Date.now().toString(36)}${seq.toString(36)}`;
}

function deselectNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
}

function deselectEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((e) => (e.selected ? { ...e, selected: false } : e));
}

function clearStaleEditing(
  s: { editing: EditingState },
  nodes: FlowNode[],
): { editing?: null; editingSavedFuture?: Snapshot[] } {
  if (s.editing && !nodes.some((n) => n.id === s.editing?.id)) {
    return { editing: null, editingSavedFuture: [] };
  }
  return {};
}

function hasEdge(edges: FlowEdge[], source: string, target: string): boolean {
  return edges.some((e) => e.source === source && e.target === target);
}

function newNode(id: string, position: XYPosition): FlowNode {
  return {
    id,
    type: "causal",
    position,
    data: { label: NEW_NODE_LABEL },
    selected: true,
  };
}

export type CausalState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  title: string;
  layoutDirection: CausalLayoutDirection;
  defaultPolarity: CausalPolarity;
  defaultBidirectional: boolean;
  history: History<Snapshot>;
  editing: EditingState;
  editingSavedFuture: Snapshot[];
  toast: string | null;
  exporting: boolean;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  replaceDocument: (
    doc: CausalJsonDocument,
    layoutDirection?: CausalLayoutDirection,
  ) => void;
  importDocument: (doc: CausalJsonDocument) => void;
  newBlank: () => void;
  setTitle: (title: string) => void;
  setDefaultPolarity: (polarity: CausalPolarity) => void;
  setDefaultBidirectional: (bidirectional: boolean) => void;
  addNode: (position: XYPosition, opts?: { edit?: boolean }) => string;
  addConnectedNode: (
    anchorId: string,
    position: XYPosition,
    side: "downstream" | "upstream",
  ) => string;
  connect: (source: string, target: string) => boolean;
  updateNodeLabel: (id: string, label: string) => void;
  updateEdge: (id: string, patch: Partial<CausalEdgeData>) => void;
  reverseEdge: (id: string) => boolean;
  deleteSelected: () => void;
  selectNodes: (ids: string[]) => void;
  selectEdge: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  pasteFragment: (doc: CausalJsonDocument, anchor?: XYPosition) => void;
  applyLayout: (direction: CausalLayoutDirection) => void;
  startEditing: (id: string) => void;
  finishEditing: (label: string | null) => void;
  showToast: (message: string) => void;
  setExporting: (exporting: boolean) => void;
};

export const useCausalStore = create<CausalState>()((set, get) => {
  const snapshot = (): Snapshot => {
    const s = get();
    return {
      nodes: s.nodes.map((n) => ({ ...n, selected: false, dragging: false })),
      edges: deselectEdges(s.edges),
      title: s.title,
      layoutDirection: s.layoutDirection,
    };
  };

  const commit = () => set((s) => ({ history: record(s.history, snapshot()) }));

  const edgeDefaults = (): CausalEdgeData => ({
    bidirectional: get().defaultBidirectional,
    polarity: get().defaultPolarity,
  });

  return {
    nodes: [],
    edges: [],
    title: "",
    layoutDirection: "LR",
    defaultPolarity: "positive",
    defaultBidirectional: false,
    history: emptyHistory<Snapshot>(),
    editing: null,
    editingSavedFuture: [],
    toast: null,
    exporting: false,

    onNodesChange: (changes) =>
      set((s) => {
        const nodes = applyNodeChanges(changes, s.nodes);
        return { nodes, ...clearStaleEditing(s, nodes) };
      }),
    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

    commit,

    undo: () => {
      const r = undoHistory(get().history, snapshot());
      if (r) set({ ...r.state, history: r.history, editing: null });
    },

    redo: () => {
      const r = redoHistory(get().history, snapshot());
      if (r) set({ ...r.state, history: r.history, editing: null });
    },

    replaceDocument: (doc, layoutDirection) => {
      const { nodes, edges } = documentToFlow(doc);
      set((s) => ({
        nodes,
        edges,
        title: doc.title ?? "",
        layoutDirection: layoutDirection ?? s.layoutDirection,
        editing: null,
      }));
    },

    importDocument: (doc) => {
      commit();
      get().replaceDocument(doc);
    },

    newBlank: () => {
      commit();
      set({ nodes: [], edges: [], title: "", editing: null });
    },

    setTitle: (title) => set({ title }),
    setDefaultPolarity: (defaultPolarity) => set({ defaultPolarity }),
    setDefaultBidirectional: (defaultBidirectional) =>
      set({ defaultBidirectional }),

    addNode: (position, opts) => {
      const savedFuture = get().history.future;
      commit();
      const id = `n-${uid()}`;
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), newNode(id, position)],
        edges: deselectEdges(s.edges),
        editing: opts?.edit ? { id, isNew: true } : null,
        editingSavedFuture: opts?.edit ? savedFuture : [],
      }));
      return id;
    },

    addConnectedNode: (anchorId, position, side) => {
      const savedFuture = get().history.future;
      commit();
      const id = `n-${uid()}`;
      const [source, target] =
        side === "downstream" ? [anchorId, id] : [id, anchorId];
      const edge = newFlowEdge(
        `e-${source}-${target}-${uid()}`,
        source,
        target,
        edgeDefaults(),
      );
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), newNode(id, position)],
        edges: [...deselectEdges(s.edges), edge],
        editing: { id, isNew: true },
        editingSavedFuture: savedFuture,
      }));
      return id;
    },

    connect: (source, target) => {
      if (hasEdge(get().edges, source, target)) {
        get().showToast(DUPLICATE_EDGE_MESSAGE);
        return false;
      }
      commit();
      const edge = newFlowEdge(
        `e-${source}-${target}-${uid()}`,
        source,
        target,
        edgeDefaults(),
      );
      set((s) => ({ edges: [...s.edges, edge] }));
      return true;
    },

    updateNodeLabel: (id, label) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n,
        ),
      })),

    updateEdge: (id, patch) => {
      commit();
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id !== id
            ? e
            : withMarkers({
                ...e,
                data: {
                  bidirectional: e.data?.bidirectional ?? false,
                  polarity: e.data?.polarity ?? "positive",
                  ...patch,
                },
              }),
        ),
      }));
    },

    reverseEdge: (id) => {
      const edge = get().edges.find((e) => e.id === id);
      if (!edge) return false;
      if (hasEdge(get().edges, edge.target, edge.source)) {
        get().showToast(DUPLICATE_EDGE_MESSAGE);
        return false;
      }
      commit();
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === id ? { ...e, source: edge.target, target: edge.source } : e,
        ),
      }));
      return true;
    },

    deleteSelected: () => {
      const { nodes, edges } = get();
      const doomed = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      const keptEdges = edges.filter(
        (e) => !e.selected && !doomed.has(e.source) && !doomed.has(e.target),
      );
      if (doomed.size === 0 && keptEdges.length === edges.length) return;
      commit();
      const nextNodes = nodes.filter((n) => !doomed.has(n.id));
      set((s) => ({
        nodes: nextNodes,
        edges: keptEdges,
        ...clearStaleEditing(s, nextNodes),
      }));
    },

    selectNodes: (ids) => {
      const wanted = new Set(ids);
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: wanted.has(n.id) })),
        edges: deselectEdges(s.edges),
      }));
    },

    selectEdge: (id) =>
      set((s) => ({
        nodes: deselectNodes(s.nodes),
        edges: s.edges.map((e) => ({ ...e, selected: e.id === id })),
      })),

    selectAll: () =>
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: true })),
        edges: s.edges.map((e) => ({ ...e, selected: true })),
      })),

    clearSelection: () =>
      set((s) => ({
        nodes: deselectNodes(s.nodes),
        edges: deselectEdges(s.edges),
      })),

    pasteFragment: (doc, anchor) => {
      if (doc.nodes.length === 0) return;
      commit();
      const frag = instantiateFragment(doc, { idSeed: uid(), anchor });
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), ...frag.nodes],
        edges: [...deselectEdges(s.edges), ...frag.edges],
      }));
    },

    applyLayout: (direction) => {
      commit();
      set((s) => ({
        layoutDirection: direction,
        nodes: layoutCausalNodes(s.nodes, s.edges, direction),
      }));
    },

    startEditing: (id) => {
      if (!get().nodes.some((n) => n.id === id)) return;
      const savedFuture = get().history.future;
      commit();
      set({ editing: { id, isNew: false }, editingSavedFuture: savedFuture });
    },

    finishEditing: (label) => {
      const { editing, nodes } = get();
      if (!editing) return;
      const text = label?.trim() ?? "";
      const previous = nodes.find((n) => n.id === editing.id)?.data.label;

      if (!text && editing.isNew) {
        // 取消新建：移除節點並丟掉建立時那筆歷史，等同從沒建過
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== editing.id),
          edges: s.edges.filter(
            (e) => e.source !== editing.id && e.target !== editing.id,
          ),
          history: { past: s.history.past.slice(0, -1), future: s.editingSavedFuture },
          editing: null,
          editingSavedFuture: [],
        }));
        return;
      }
      if (!text || (!editing.isNew && text === previous)) {
        set((s) => ({
          history: {
            past: s.history.past.slice(0, -1),
            future: s.editingSavedFuture,
          },
          editing: null,
          editingSavedFuture: [],
        }));
        return;
      }
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === editing.id ? { ...n, data: { ...n.data, label: text } } : n,
        ),
        editing: null,
        editingSavedFuture: [],
      }));
    },

    showToast: (message) => {
      set({ toast: message });
      setTimeout(() => {
        if (get().toast === message) set({ toast: null });
      }, TOAST_MS);
    },

    setExporting: (exporting) => set({ exporting }),
  };
});
