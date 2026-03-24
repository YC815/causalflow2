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
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

const LS_LEFT = "causalflow-ui-left-collapsed";
const LS_TOOLS = "causalflow-ui-tools-collapsed";

function IcoChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IcoChevronUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function IcoPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IcoSliders({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M9 8h6M15 16h6" />
    </svg>
  );
}

const shellBtn =
  "causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2 py-1.5 text-xs text-[var(--causal-ink)] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50";
const shellBtnPrimary =
  "causal-ui rounded-lg bg-[var(--causal-accent)] px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

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
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorText, setJsonEditorText] = useState("");
  const [leftBarCollapsed, setLeftBarCollapsed] = useState(false);
  const [toolsBarCollapsed, setToolsBarCollapsed] = useState(false);
  const [layoutDirection, setLayoutDirection] =
    useState<CausalLayoutDirection>("LR");

  useEffect(() => {
    try {
      if (localStorage.getItem(LS_LEFT) === "1") setLeftBarCollapsed(true);
      if (localStorage.getItem(LS_TOOLS) === "0") setToolsBarCollapsed(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LEFT, leftBarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [leftBarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TOOLS, toolsBarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [toolsBarCollapsed]);
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

  const openJsonEditor = useCallback(() => {
    const doc = flowToDocument(
      nodes as Node<CausalNodeData>[],
      edges as Edge<CausalEdgeData>[],
      title.trim() || undefined,
    );
    setJsonEditorText(stringifyCausalJson(doc));
    setJsonEditorOpen(true);
  }, [edges, nodes, title]);

  const applyJsonEditor = useCallback(() => {
    try {
      const doc = parseCausalJson(jsonEditorText);
      const { nodes: nn, edges: ee } = documentToFlow(doc);
      setNodes(nn);
      setEdges(ee);
      setTitle(doc.title ?? "");
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setJsonEditorOpen(false);
      showToast("已套用 JSON 變更");
    } catch (err) {
      const msg = err instanceof CausalJsonError ? err.message : "JSON 套用失敗";
      showToast(msg);
    }
  }, [jsonEditorText, setEdges, setNodes, setTitle, showToast]);

  const formatJsonEditor = useCallback(() => {
    try {
      const doc = parseCausalJson(jsonEditorText);
      setJsonEditorText(stringifyCausalJson(doc));
      showToast("已自動格式化 JSON");
    } catch (err) {
      const msg =
        err instanceof CausalJsonError ? err.message : "JSON 格式化失敗";
      showToast(msg);
    }
  }, [jsonEditorText, showToast]);

  useEffect(() => {
    if (!jsonEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setJsonEditorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jsonEditorOpen]);

  const exportViewportImage = useCallback(
    async (kind: "png" | "pdf", pdfOrientation?: "portrait" | "landscape") => {
      const viewportEl = flowWrapRef.current?.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement | null;
      if (!viewportEl) {
        showToast("無法匯出：找不到畫布");
        return;
      }
      const prev = getViewport();
      const prevLayoutDirection = layoutDirection;
      const prevNodes = nodes;
      let didTemporarilyRelayout = false;
      setExportingImage(true);
      try {
        const o = pdfOrientation ?? "portrait";
        const shouldReLayoutForPdf = kind === "pdf";
        if (shouldReLayoutForPdf) {
          const nextDirection: CausalLayoutDirection =
            o === "portrait" ? "TB" : "LR";
          if (nextDirection !== layoutDirection) {
            // 匯出前先重排成目標方向，避免「直式 PDF 只是縮小橫圖」。
            flushSync(() => {
              setLayoutDirection(nextDirection);
              setNodes((ns) =>
                layoutCausalNodes(
                  ns as Node<CausalNodeData>[],
                  edges as Edge<CausalEdgeData>[],
                  nextDirection,
                ),
              );
            });
            didTemporarilyRelayout = true;
          }
        }
        await fitView({ padding: 0.15, duration: 0 });
        await new Promise<void>((r) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => r());
          });
        });
        const base = safeExportBasename(title);
        if (kind === "png") {
          const dataUrl = await captureViewportToPngDataUrl(viewportEl);
          downloadPngFromDataUrl(dataUrl, `${base}.png`);
          showToast("已下載 PNG");
        } else {
          const dataUrl = await captureViewportToPngDataUrl(viewportEl, {
            // PDF 走高解析位圖，提升文字與線條清晰度。
            pixelRatio: 4,
          });
          await downloadPdfFromPngDataUrl(dataUrl, `${base}.pdf`, {
            orientation: o,
          });
          showToast(o === "portrait" ? "已下載 PDF（直式 A4）" : "已下載 PDF（橫式 A4）");
        }
      } catch {
        showToast(kind === "png" ? "PNG 匯出失敗" : "PDF 匯出失敗");
      } finally {
        if (didTemporarilyRelayout) {
          flushSync(() => {
            setLayoutDirection(prevLayoutDirection);
            setNodes(prevNodes);
          });
        }
        setViewport(prev, { duration: 0 });
        setExportingImage(false);
      }
    },
    [
      edges,
      fitView,
      getViewport,
      layoutDirection,
      nodes,
      setNodes,
      setViewport,
      showToast,
      title,
    ],
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

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0">
          {leftBarCollapsed ? (
            <button
              type="button"
              onClick={() => setLeftBarCollapsed(false)}
              className="causal-ui group flex max-w-full items-center gap-2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 py-2 pl-3 pr-3 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md transition hover:border-[var(--causal-accent)] hover:shadow-lg"
              aria-expanded={false}
            >
              <span className="causal-display truncate text-sm font-semibold tracking-tight text-[var(--causal-ink)]">
                CausalFlow
              </span>
              <IcoChevronDown className="h-4 w-4 shrink-0 text-[var(--causal-ink-muted)] transition group-hover:text-[var(--causal-accent)]" />
            </button>
          ) : (
            <div className="relative max-w-[min(100%,18rem)] rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 p-3 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="causal-display text-lg leading-tight tracking-tight text-[var(--causal-ink)]">
                    CausalFlow
                  </h1>
                  <p className="causal-ui mt-1 text-[11px] leading-snug text-[var(--causal-ink-muted)]">
                    因果圖 · 拖曳連線 · JSON／PNG／PDF
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLeftBarCollapsed(true)}
                  className="causal-ui -mr-0.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]"
                  aria-label="收合標題區"
                  title="收合"
                >
                  <IcoChevronUp className="h-4 w-4" />
                </button>
              </div>
              <label htmlFor={`${formId}-title`} className="sr-only">
                圖標題
              </label>
              <input
                id={`${formId}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="圖標題（可選）"
                className="causal-ui mt-2.5 w-full rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2.5 py-1.5 text-sm text-[var(--causal-ink)] placeholder:text-[var(--causal-ink-muted)]"
              />
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />

          {toolsBarCollapsed ? (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 p-1.5 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md">
              <button
                type="button"
                onClick={addNode}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--causal-accent)] text-white shadow-sm transition hover:opacity-90"
                title="新增節點"
                aria-label="新增節點"
              >
                <IcoPlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setToolsBarCollapsed(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] text-[var(--causal-ink)] transition hover:bg-black/[0.05]"
                title="展開工具（匯入 JSON／匯出圖檔）"
                aria-expanded={false}
                aria-label="展開工具（匯入 JSON／匯出圖檔）"
              >
                <IcoSliders className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <aside className="w-[min(calc(100vw-1.5rem),17.5rem)] rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2">
                <span className="causal-ui text-xs font-medium tracking-wide text-[var(--causal-ink-muted)]">
                  工具
                </span>
                <button
                  type="button"
                  onClick={() => setToolsBarCollapsed(true)}
                  className="causal-ui flex h-8 w-8 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]"
                  aria-label="收合工具列"
                  title="收合"
                >
                  <IcoChevronUp className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[min(70vh,calc(100dvh-8rem))] space-y-2.5 overflow-y-auto p-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={addNode}
                    className={shellBtnPrimary}
                  >
                    新增節點
                  </button>
                  <button
                    type="button"
                    onClick={autoLayout}
                    className={shellBtn}
                  >
                    一鍵排版
                  </button>
                  <button
                    type="button"
                    onClick={toggleLayoutOrientation}
                    title={
                      layoutDirection === "LR"
                        ? "橫式版面：改為直式並重新排版"
                        : "直式版面：改為橫式並重新排版"
                    }
                    className={shellBtn}
                  >
                    {layoutDirection === "LR" ? "切直式" : "切橫式"}
                  </button>
                </div>

                <details
                  open
                  className="group rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="causal-ui flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium text-[var(--causal-ink)] marker:content-none">
                    <span>匯入／匯出 JSON</span>
                    <IcoChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={shellBtn}
                    >
                      匯入 JSON
                    </button>
                    <button
                      type="button"
                      onClick={exportJson}
                      className={shellBtn}
                    >
                      匯出 JSON
                    </button>
                    <button
                      type="button"
                      onClick={openJsonEditor}
                      className={shellBtn}
                    >
                      查看／編輯 JSON
                    </button>
                  </div>
                </details>

                <details
                  open
                  className="group rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="causal-ui flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium text-[var(--causal-ink)] marker:content-none">
                    <span>匯出圖檔</span>
                    <IcoChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
                    <button
                      type="button"
                      disabled={exportingImage}
                      onClick={() => void exportViewportImage("png")}
                      className={shellBtn}
                    >
                      匯出 PNG 圖檔
                    </button>
                    <button
                      type="button"
                      disabled={exportingImage}
                      onClick={() => void exportViewportImage("pdf", "portrait")}
                      className={shellBtn}
                    >
                      匯出 PDF（直式 A4）
                    </button>
                    <button
                      type="button"
                      disabled={exportingImage}
                      onClick={() =>
                        void exportViewportImage("pdf", "landscape")
                      }
                      className={shellBtn}
                    >
                      匯出 PDF（橫式 A4）
                    </button>
                  </div>
                </details>

                <div>
                  <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
                    新連線預設
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setDefaultBidirectional(false)}
                      className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
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
                      className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
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
                      className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                        defaultPolarity === "positive"
                          ? "bg-[var(--causal-edge-pos-muted)] text-[var(--causal-ink)]"
                          : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                      }`}
                    >
                      正
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultPolarity("negative")}
                      className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                        defaultPolarity === "negative"
                          ? "bg-[var(--causal-edge-neg-muted)] text-[var(--causal-ink)]"
                          : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                      }`}
                    >
                      負
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultPolarity("neutral")}
                      className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                        defaultPolarity === "neutral"
                          ? "bg-[var(--causal-edge-neutral-muted)] text-[var(--causal-ink)]"
                          : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
                      }`}
                    >
                      未指定
                    </button>
                  </div>
                </div>

                {selectedNode && (
                  <div className="border-t border-[var(--causal-node-border)] pt-2.5">
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
                      className="causal-ui mt-1.5 w-full resize-y rounded-lg border border-[var(--causal-node-border)] bg-white px-2 py-1.5 text-sm text-[var(--causal-ink)]"
                    />
                  </div>
                )}

                {selectedEdge && (
                  <div className="border-t border-[var(--causal-node-border)] pt-2.5">
                    <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
                      選中連線
                    </p>
                    <p className="causal-mono mt-1 break-all text-[10px] text-[var(--causal-ink-muted)]">
                      {selectedEdge.source} → {selectedEdge.target}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedEdge({
                            bidirectional: !selectedEdge.data?.bidirectional,
                          })
                        }
                        className="causal-ui rounded-md bg-[var(--causal-paper-2)] px-2 py-1 text-[11px] text-[var(--causal-ink)]"
                      >
                        {(selectedEdge.data?.bidirectional ?? false)
                          ? "改單向"
                          : "改雙向"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedEdge({ polarity: "positive" })
                        }
                        className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                          (selectedEdge.data?.polarity ?? "positive") ===
                          "positive"
                            ? "bg-[var(--causal-edge-pos-muted)] text-[var(--causal-ink)]"
                            : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                        }`}
                      >
                        正
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedEdge({ polarity: "negative" })
                        }
                        className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                          (selectedEdge.data?.polarity ?? "positive") ===
                          "negative"
                            ? "bg-[var(--causal-edge-neg-muted)] text-[var(--causal-ink)]"
                            : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                        }`}
                      >
                        負
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedEdge({ polarity: "neutral" })
                        }
                        className={`causal-ui rounded-md px-2 py-1 text-[11px] ${
                          (selectedEdge.data?.polarity ?? "positive") ===
                          "neutral"
                            ? "bg-[var(--causal-edge-neutral-muted)] text-[var(--causal-ink)]"
                            : "bg-[var(--causal-paper-2)] text-[var(--causal-ink)]"
                        }`}
                      >
                        未指定
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </header>

      {jsonEditorOpen && (
        <div
          className="causal-ui absolute inset-0 z-[110] flex items-center justify-center bg-black/45 p-3 sm:p-5"
          onClick={() => setJsonEditorOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="JSON 編輯器"
            className="flex h-[90dvh] w-[90vw] max-w-none flex-col rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2.5">
              <h2 className="text-sm font-semibold text-[var(--causal-ink)]">
                JSON 編輯器
              </h2>
              <button
                type="button"
                onClick={() => setJsonEditorOpen(false)}
                className={shellBtn}
              >
                關閉
              </button>
            </header>
            <div className="min-h-0 flex-1 p-3">
              <textarea
                value={jsonEditorText}
                onChange={(e) => setJsonEditorText(e.target.value)}
                className="causal-mono h-full w-full resize-none rounded-lg border border-[var(--causal-node-border)] bg-white px-3 py-2 text-xs leading-6 text-[var(--causal-ink)]"
                spellCheck={false}
              />
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--causal-node-border)] px-3 py-2.5">
              <button
                type="button"
                onClick={formatJsonEditor}
                className={shellBtn}
              >
                自動格式化 JSON
              </button>
              <button
                type="button"
                onClick={openJsonEditor}
                className={shellBtn}
              >
                重新載入目前 JSON
              </button>
              <button
                type="button"
                onClick={applyJsonEditor}
                className={shellBtnPrimary}
              >
                套用變更
              </button>
            </footer>
          </section>
        </div>
      )}

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
