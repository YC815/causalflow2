"use client";

import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useId, useRef, useState } from "react";
import {
  CausalJsonError,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import type { CausalEdgeData } from "./causal-edge";
import { CausalEdge } from "./causal-edge";
import type { CausalNodeData } from "./causal-node";
import { CausalNode } from "./causal-node";
import {
  documentToFlow,
  flowToDocument,
  newFlowEdge,
  withMarkers,
} from "./flow-adapters";
import { JsonGuidePanel } from "./json-guide-panel";

const nodeTypes = { causal: CausalNode };
const edgeTypes = { causal: CausalEdge };

function FlowCanvas({
  title,
  setTitle,
}: {
  title: string;
  setTitle: (t: string) => void;
}) {
  const initial = documentToFlow(SAMPLE_CAUSAL_DOCUMENT);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const edgeSeq = useRef(0);
  const formId = useId();

  const [defaultBidirectional, setDefaultBidirectional] = useState(false);
  const [defaultPolarity, setDefaultPolarity] = useState<
    "positive" | "negative"
  >("positive");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      setEdges((eds) => {
        if (
          eds.some((e) => e.source === c.source && e.target === c.target)
        ) {
          showToast("兩節點之間已有連線");
          return eds;
        }
        const id = `e-${c.source}-${c.target}-${edgeSeq.current++}`;
        const next = newFlowEdge(id, c.source, c.target, {
          bidirectional: defaultBidirectional,
          polarity: defaultPolarity,
        });
        return [...eds, next];
      });
    },
    [defaultBidirectional, defaultPolarity, setEdges, showToast],
  );

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeId(ns[0]?.id ?? null);
      setSelectedEdgeId(es[0]?.id ?? null);
    },
    [],
  );

  const addNode = useCallback(() => {
    const id = `n-${Date.now().toString(36)}`;
    const pos = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "causal",
        position: { x: pos.x - 70, y: pos.y - 28 },
        data: { label: "新節點" },
      },
    ]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, [screenToFlowPosition, setNodes]);

  const updateSelectedNodeLabel = useCallback(
    (label: string) => {
      if (!selectedNodeId) return;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, label } }
            : n,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const updateSelectedEdge = useCallback(
    (patch: Partial<CausalEdgeData>) => {
      if (!selectedEdgeId) return;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== selectedEdgeId) return e;
          const data: CausalEdgeData = {
            bidirectional: e.data?.bidirectional ?? false,
            polarity: e.data?.polarity ?? "positive",
            ...patch,
          };
          return withMarkers({ ...e, data });
        }),
      );
    },
    [selectedEdgeId, setEdges],
  );

  const exportJson = useCallback(() => {
    const doc = flowToDocument(
      nodes as Node<CausalNodeData>[],
      edges as Edge<CausalEdgeData>[],
      title.trim() || undefined,
    );
    const blob = new Blob([stringifyCausalJson(doc)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "causalflow.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("已下載 causalflow.json");
  }, [edges, nodes, showToast, title]);

  const onFile = useCallback(
    async (f: File | null) => {
      if (!f) return;
      try {
        const text = await f.text();
        const doc = parseCausalJson(text);
        const { nodes: nn, edges: ee } = documentToFlow(doc);
        setNodes(nn);
        setEdges(ee);
        setTitle(doc.title ?? "");
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        showToast("已匯入 JSON");
      } catch (err) {
        const msg =
          err instanceof CausalJsonError ? err.message : "匯入失敗";
        showToast(msg);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [setEdges, setNodes, setTitle, showToast],
  );

  return (
    <div className="relative h-[100dvh] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.6}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.1}
          color="var(--causal-dot)"
        />
        <Controls
          className="!border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md [&_button]:!fill-[var(--causal-ink)]"
          showInteractive={false}
        />
      </ReactFlow>

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto max-w-md rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 px-4 py-3 shadow-md backdrop-blur-sm">
          <h1 className="causal-display text-xl tracking-tight text-[var(--causal-ink)]">
            CausalFlow
          </h1>
          <p className="causal-ui mt-1 text-xs text-[var(--causal-ink-muted)]">
            邏輯因果圖 · 拖曳連線 · 匯入／匯出 JSON
          </p>
          <label htmlFor={`${formId}-title`} className="sr-only">
            圖標題
          </label>
          <input
            id={`${formId}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="圖標題（可選，會寫入 JSON）"
            className="causal-ui mt-3 w-full rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] placeholder:text-[var(--causal-ink-muted)]"
          />
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2 sm:flex-row sm:items-start">
          <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 p-2 shadow-md backdrop-blur-sm">
            <button
              type="button"
              onClick={addNode}
              className="causal-ui rounded-lg bg-[var(--causal-accent)] px-3 py-2 text-sm text-white hover:opacity-90"
            >
              新增節點
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04]"
            >
              匯入 JSON
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04]"
            >
              匯出 JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <aside className="w-[min(100%,18rem)] rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 p-3 shadow-md backdrop-blur-sm">
            <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
              新連線預設
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDefaultBidirectional(false)}
                className={`causal-ui rounded-md px-2 py-1 text-xs ${
                  !defaultBidirectional
                    ? "bg-[var(--causal-accent-muted)] text-[var(--causal-ink)]"
                    : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                }`}
              >
                單向
              </button>
              <button
                type="button"
                onClick={() => setDefaultBidirectional(true)}
                className={`causal-ui rounded-md px-2 py-1 text-xs ${
                  defaultBidirectional
                    ? "bg-[var(--causal-accent-muted)] text-[var(--causal-ink)]"
                    : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                }`}
              >
                雙向
              </button>
              <button
                type="button"
                onClick={() => setDefaultPolarity("positive")}
                className={`causal-ui rounded-md px-2 py-1 text-xs ${
                  defaultPolarity === "positive"
                    ? "bg-[var(--causal-edge-pos-muted)] text-[var(--causal-ink)]"
                    : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                }`}
              >
                正相關
              </button>
              <button
                type="button"
                onClick={() => setDefaultPolarity("negative")}
                className={`causal-ui rounded-md px-2 py-1 text-xs ${
                  defaultPolarity === "negative"
                    ? "bg-[var(--causal-edge-neg-muted)] text-[var(--causal-ink)]"
                    : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                }`}
              >
                負相關
              </button>
            </div>

            {selectedNode && (
              <div className="mt-3 border-t border-[var(--causal-node-border)] pt-3">
                <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
                  選中節點
                </p>
                <label htmlFor={`${formId}-nlabel`} className="sr-only">
                  節點文字
                </label>
                <textarea
                  id={`${formId}-nlabel`}
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                  rows={3}
                  className="causal-serif mt-2 w-full resize-y rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2 py-1.5 text-sm text-[var(--causal-ink)]"
                />
              </div>
            )}

            {selectedEdge && (
              <div className="mt-3 border-t border-[var(--causal-node-border)] pt-3">
                <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
                  選中連線
                </p>
                <p className="causal-mono mt-1 text-[10px] text-[var(--causal-ink-muted)]">
                  {selectedEdge.source} → {selectedEdge.target}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedEdge({
                        bidirectional: !selectedEdge.data?.bidirectional,
                      })
                    }
                    className="causal-ui rounded-md bg-[var(--causal-paper-2)] px-2 py-1 text-xs text-[var(--causal-ink)]"
                  >
                    {(selectedEdge.data?.bidirectional ?? false)
                      ? "改為單向"
                      : "改為雙向"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedEdge({
                        polarity:
                          selectedEdge.data?.polarity === "negative"
                            ? "positive"
                            : "negative",
                      })
                    }
                    className="causal-ui rounded-md bg-[var(--causal-paper-2)] px-2 py-1 text-xs text-[var(--causal-ink)]"
                  >
                    {(selectedEdge.data?.polarity ?? "positive") === "negative"
                      ? "改為正相關"
                      : "改為負相關"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </header>

      {toast && (
        <div
          role="status"
          className="causal-ui absolute bottom-20 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)] px-4 py-2 text-sm text-[var(--causal-ink)] shadow-lg"
        >
          {toast}
        </div>
      )}

      <JsonGuidePanel />
    </div>
  );
}

export function CausalFlowApp() {
  const [title, setTitle] = useState(SAMPLE_CAUSAL_DOCUMENT.title ?? "");
  return (
    <ReactFlowProvider>
      <FlowCanvas title={title} setTitle={setTitle} />
    </ReactFlowProvider>
  );
}
