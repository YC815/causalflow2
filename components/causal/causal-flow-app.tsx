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
import { flushSync } from "react-dom";
import {
  CausalJsonError,
  type CausalPolarity,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import type { CausalEdgeData } from "./causal-edge";
import { CausalEdge } from "./causal-edge";
import type { CausalNodeData } from "./causal-node";
import { CausalNode } from "./causal-node";
import {
  type CausalLayoutDirection,
  layoutCausalNodes,
} from "@/lib/causal-auto-layout";
import {
  documentToFlow,
  flowToDocument,
  newFlowEdge,
  withMarkers,
} from "./flow-adapters";
import {
  CausalOrientationProvider,
  type CausalFlowOrientation,
} from "./causal-orientation-context";
import { JsonGuidePanel } from "./json-guide-panel";
import {
  captureViewportToPngDataUrl,
  downloadPdfFromPngDataUrl,
  downloadPngFromDataUrl,
  safeExportBasename,
} from "@/lib/causal-flow-export";

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
  const { screenToFlowPosition, fitView, getViewport, setViewport } =
    useReactFlow();
  const flowWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const edgeSeq = useRef(0);
  const formId = useId();

  const [defaultBidirectional, setDefaultBidirectional] = useState(false);
  const [defaultPolarity, setDefaultPolarity] =
    useState<CausalPolarity>("positive");

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const [layoutDirection, setLayoutDirection] =
    useState<CausalLayoutDirection>("LR");
  const flowOrientation: CausalFlowOrientation =
    layoutDirection === "LR" ? "horizontal" : "vertical";

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

  const autoLayout = useCallback(() => {
    flushSync(() => {
      setNodes((ns) =>
        layoutCausalNodes(
          ns as Node<CausalNodeData>[],
          edges as Edge<CausalEdgeData>[],
          layoutDirection,
        ),
      );
    });
    fitView({ padding: 0.2, duration: 280 });
  }, [edges, fitView, layoutDirection, setNodes]);

  const toggleLayoutOrientation = useCallback(() => {
    const next: CausalLayoutDirection =
      layoutDirection === "LR" ? "TB" : "LR";
    setLayoutDirection(next);
    flushSync(() => {
      setNodes((ns) =>
        layoutCausalNodes(
          ns as Node<CausalNodeData>[],
          edges as Edge<CausalEdgeData>[],
          next,
        ),
      );
    });
    fitView({ padding: 0.2, duration: 280 });
  }, [edges, fitView, layoutDirection, setNodes]);

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

  const exportViewportImage = useCallback(
    async (kind: "png" | "pdf") => {
      const viewportEl = flowWrapRef.current?.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement | null;
      if (!viewportEl) {
        showToast("無法匯出：找不到畫布");
        return;
      }
      const prev = getViewport();
      setExportingImage(true);
      try {
        await fitView({ padding: 0.15, duration: 0 });
        await new Promise<void>((r) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => r());
          });
        });
        const dataUrl = await captureViewportToPngDataUrl(viewportEl);
        const base = safeExportBasename(title);
        if (kind === "png") {
          downloadPngFromDataUrl(dataUrl, `${base}.png`);
          showToast("已下載 PNG");
        } else {
          await downloadPdfFromPngDataUrl(dataUrl, `${base}.pdf`);
          showToast("已下載 PDF");
        }
      } catch {
        showToast(kind === "png" ? "PNG 匯出失敗" : "PDF 匯出失敗");
      } finally {
        setViewport(prev, { duration: 0 });
        setExportingImage(false);
      }
    },
    [fitView, getViewport, setViewport, showToast, title],
  );

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
      <CausalOrientationProvider orientation={flowOrientation}>
      <div ref={flowWrapRef} className="h-full w-full min-h-0">
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
      </div>
      </CausalOrientationProvider>

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto max-w-md rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 px-4 py-3 shadow-md backdrop-blur-sm">
          <h1 className="causal-display text-xl tracking-tight text-[var(--causal-ink)]">
            CausalFlow
          </h1>
          <p className="causal-ui mt-1 text-xs text-[var(--causal-ink-muted)]">
            邏輯因果圖 · 拖曳連線 · 匯入／匯出 JSON、PNG、PDF
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
              onClick={autoLayout}
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04]"
            >
              一鍵排版
            </button>
            <button
              type="button"
              onClick={toggleLayoutOrientation}
              title={
                layoutDirection === "LR"
                  ? "橫式：連接點在卡片左右側。點擊改為直式（連接點在上下方）並重新排版"
                  : "直式：連接點在卡片上下方。點擊改為橫式（連接點在左右側）並重新排版"
              }
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04]"
            >
              {layoutDirection === "LR" ? "切為直式" : "切為橫式"}
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
            <button
              type="button"
              disabled={exportingImage}
              onClick={() => void exportViewportImage("png")}
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              匯出 PNG
            </button>
            <button
              type="button"
              disabled={exportingImage}
              onClick={() => void exportViewportImage("pdf")}
              className="causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-3 py-2 text-sm text-[var(--causal-ink)] hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              匯出 PDF
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
              <button
                type="button"
                onClick={() => setDefaultPolarity("neutral")}
                className={`causal-ui rounded-md px-2 py-1 text-xs ${
                  defaultPolarity === "neutral"
                    ? "bg-[var(--causal-edge-neutral-muted)] text-[var(--causal-ink)]"
                    : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                }`}
              >
                未指定
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
                  className="causal-ui mt-2 w-full resize-y rounded-lg border border-[var(--causal-node-border)] bg-white px-2 py-1.5 text-sm text-[var(--causal-ink)]"
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
                    onClick={() => updateSelectedEdge({ polarity: "positive" })}
                    className={`causal-ui rounded-md px-2 py-1 text-xs ${
                      (selectedEdge.data?.polarity ?? "positive") ===
                      "positive"
                        ? "bg-[var(--causal-edge-pos-muted)] text-[var(--causal-ink)]"
                        : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                    }`}
                  >
                    正相關
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedEdge({ polarity: "negative" })}
                    className={`causal-ui rounded-md px-2 py-1 text-xs ${
                      (selectedEdge.data?.polarity ?? "positive") ===
                      "negative"
                        ? "bg-[var(--causal-edge-neg-muted)] text-[var(--causal-ink)]"
                        : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                    }`}
                  >
                    負相關
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedEdge({ polarity: "neutral" })}
                    className={`causal-ui rounded-md px-2 py-1 text-xs ${
                      (selectedEdge.data?.polarity ?? "positive") === "neutral"
                        ? "bg-[var(--causal-edge-neutral-muted)] text-[var(--causal-ink)]"
                        : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                    }`}
                  >
                    未指定
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
