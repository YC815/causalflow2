"use client";

import { useReactFlow, type XYPosition } from "@xyflow/react";
import { type RefObject, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  type CausalLayoutDirection,
  layoutCausalNodes,
} from "@/lib/causal-auto-layout";
import { captureViewportToPngDataUrl, downloadPdfFromPngDataUrl, downloadPngFromDataUrl, safeExportBasename } from "@/lib/causal-flow-export";
import {
  type CausalJsonDocument,
  CausalJsonError,
  type CausalPolarity,
  type HandleSide,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { extractFragment } from "@/lib/clipboard";
import { type ArrowDirection, findNeighbor } from "@/lib/navigation";
import { downstreamPosition, nodeRect, siblingPosition } from "@/lib/placement";
import { type FlowNode, useCausalStore } from "@/lib/store/causal-store";
import { useFilesStore } from "@/lib/store/files-store";
import { flowToDocument } from "./flow-adapters";

/** 新節點以游標為中心放置時的半寬／半高 */
const NODE_HALF = { x: 70, y: 28 };

let internalClipboard: CausalJsonDocument | null = null;

export function hasInternalClipboard(): boolean {
  return internalClipboard !== null;
}

const store = () => useCausalStore.getState();

function singleSelectedNode(): FlowNode | null {
  const picked = store().nodes.filter((n) => n.selected);
  return picked.length === 1 ? picked[0] : null;
}

function singleSelectedEdgeId(): string | null {
  const { nodes, edges } = store();
  if (nodes.some((n) => n.selected)) return null;
  const picked = edges.filter((e) => e.selected);
  return picked.length === 1 ? picked[0].id : null;
}

function centered(p: XYPosition): XYPosition {
  return { x: p.x - NODE_HALF.x, y: p.y - NODE_HALF.y };
}

export type CausalCommands = ReturnType<typeof useCausalCommands>;

export function useCausalCommands(
  flowWrapRef: RefObject<HTMLDivElement | null>,
) {
  const { screenToFlowPosition, fitView, getViewport, setViewport, setCenter } =
    useReactFlow();

  return useMemo(() => {
    const relayout = (direction: CausalLayoutDirection) => {
      flushSync(() => store().applyLayout(direction));
      void fitView({ padding: 0.2, duration: 280 });
    };

    const ensureVisible = (id: string) => {
      const node = store().nodes.find((n) => n.id === id);
      if (!node) return;
      const r = nodeRect(node);
      const { x, y, zoom } = getViewport();
      const left = r.x * zoom + x;
      const top = r.y * zoom + y;
      const inside =
        left >= 0 &&
        top >= 0 &&
        left + r.width * zoom <= window.innerWidth &&
        top + r.height * zoom <= window.innerHeight;
      if (inside) return;
      void setCenter(r.x + r.width / 2, r.y + r.height / 2, {
        zoom,
        duration: 200,
      });
    };

    const allRects = () => store().nodes.map(nodeRect);

    const copySelection = (): CausalJsonDocument | null => {
      const frag = extractFragment(store().nodes, store().edges);
      if (frag) internalClipboard = frag;
      return frag;
    };

    const currentJson = () => {
      const { nodes, edges, title } = store();
      return stringifyCausalJson(
        flowToDocument(nodes, edges, title.trim() || undefined),
      );
    };

    return {
      undo: () => store().undo(),
      redo: () => store().redo(),
      autoLayout: () => relayout(store().layoutDirection),
      toggleOrientation: () =>
        relayout(store().layoutDirection === "LR" ? "TB" : "LR"),

      newFile: () => {
        useFilesStore.getState().createFile();
      },

      addNodeAtCenter: () => {
        const p = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        store().addNode(centered(p), { edit: true });
      },

      addNodeAtScreen: (point: XYPosition) => {
        store().addNode(centered(screenToFlowPosition(point)), { edit: true });
      },

      addConnectedNodeAtScreen: (
        anchorId: string,
        point: XYPosition,
        side: "downstream" | "upstream",
        anchorHandle?: HandleSide,
      ) => {
        store().addConnectedNode(
          anchorId,
          centered(screenToFlowPosition(point)),
          side,
          { anchorHandle },
        );
      },

      createDownstream: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const pos = downstreamPosition(
          nodeRect(n),
          store().layoutDirection,
          allRects(),
          Boolean(n.data.flipped),
        );
        ensureVisible(
          store().addConnectedNode(n.id, pos, "downstream", {
            flipped: Boolean(n.data.flipped),
          }),
        );
        return true;
      },

      createSibling: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const pos = siblingPosition(
          nodeRect(n),
          store().layoutDirection,
          allRects(),
        );
        const upstream = store().edges.find((e) => e.target === n.id)?.source;
        // 同層節點沿用目前節點的翻轉狀態
        const flipped = Boolean(n.data.flipped);
        const id = upstream
          ? store().addConnectedNode(upstream, pos, "downstream", { flipped })
          : store().addNode(pos, { edit: true, flipped });
        ensureVisible(id);
        return true;
      },

      editSelected: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        store().startEditing(n.id);
        return true;
      },

      editNode: (id: string) => {
        store().selectNodes([id]);
        store().startEditing(id);
      },

      navigate: (direction: ArrowDirection): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const candidates = store()
          .nodes.filter((o) => o.id !== n.id)
          .map((o) => ({ id: o.id, rect: nodeRect(o) }));
        const next = findNeighbor(nodeRect(n), candidates, direction);
        if (next) {
          store().selectNodes([next]);
          ensureVisible(next);
        }
        return true;
      },

      selectAll: () => store().selectAll(),
      clearSelection: () => store().clearSelection(),
      deleteSelected: () => store().deleteSelected(),

      copySelection,

      copyToSystemClipboard: () => {
        const frag = copySelection();
        if (!frag) return;
        void navigator.clipboard
          ?.writeText(stringifyCausalJson(frag))
          .catch(() => undefined);
        store().showToast(`已複製 ${frag.nodes.length} 個節點`);
      },

      cutSelection: () => {
        if (copySelection()) store().deleteSelected();
      },

      pasteDocument: (
        doc: CausalJsonDocument | null,
        anchorScreen?: XYPosition,
      ): boolean => {
        const source = doc ?? internalClipboard;
        if (!source) return false;
        store().pasteFragment(
          source,
          anchorScreen ? screenToFlowPosition(anchorScreen) : undefined,
        );
        return true;
      },

      duplicate: () => {
        const frag = extractFragment(store().nodes, store().edges);
        if (frag) store().pasteFragment(frag);
      },

      setSelectedEdgePolarity: (polarity: CausalPolarity): boolean => {
        const id = singleSelectedEdgeId();
        if (!id) return false;
        store().updateEdge(id, { polarity });
        return true;
      },

      reverseSelectedEdge: () => {
        const id = singleSelectedEdgeId();
        if (id) store().reverseEdge(id);
      },

      toggleSelectedEdgeSide: (end: "source" | "target") => {
        const id = singleSelectedEdgeId();
        if (id) store().toggleEdgeSide(id, end);
      },

      resetSelectedEdgeBend: () => {
        const id = singleSelectedEdgeId();
        if (id) store().resetEdgeBend(id);
      },

      toggleFlipSelected: (): boolean => {
        const ids = store()
          .nodes.filter((n) => n.selected)
          .map((n) => n.id);
        if (ids.length === 0) return false;
        store().toggleFlip(ids);
        return true;
      },

      focusNode: (id: string) => {
        store().selectNodes([id]);
        void fitView({ nodes: [{ id }], duration: 280, maxZoom: 1.2, padding: 0.6 });
      },

      importText: (text: string): string | null => {
        try {
          store().importDocument(parseCausalJson(text));
          return null;
        } catch (err) {
          return err instanceof CausalJsonError ? err.message : "匯入失敗";
        }
      },

      /** 匯入的 JSON 檔一律開成新檔案，不覆蓋目前的圖 */
      importAsNewFile: (text: string): string | null => {
        let doc: CausalJsonDocument;
        try {
          doc = parseCausalJson(text);
        } catch (err) {
          return err instanceof CausalJsonError ? err.message : "匯入失敗";
        }
        useFilesStore.getState().createFile(doc);
        store().showToast("已匯入為新檔案");
        return null;
      },

      currentJson,

      exportJson: () => {
        const blob = new Blob([currentJson()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "causalflow.json";
        a.click();
        URL.revokeObjectURL(a.href);
        store().showToast("已下載 causalflow.json");
      },

      exportImage: async (
        kind: "png" | "pdf",
        pdfOrientation: "portrait" | "landscape" = "portrait",
      ) => {
        const viewportEl = flowWrapRef.current?.querySelector(
          ".react-flow__viewport",
        ) as HTMLElement | null;
        if (!viewportEl) {
          store().showToast("無法匯出：找不到畫布");
          return;
        }
        const prevViewport = getViewport();
        const { nodes: prevNodes, edges, layoutDirection: prevDirection, title } =
          store();
        const targetDirection: CausalLayoutDirection =
          pdfOrientation === "portrait" ? "TB" : "LR";
        const relayoutForPdf = kind === "pdf" && targetDirection !== prevDirection;
        store().setExporting(true);
        try {
          if (relayoutForPdf) {
            // 匯出前先重排成目標方向，避免「直式 PDF 只是縮小橫圖」。不進歷史。
            flushSync(() =>
              useCausalStore.setState({
                layoutDirection: targetDirection,
                nodes: layoutCausalNodes(prevNodes, edges, targetDirection),
              }),
            );
          }
          await fitView({ padding: 0.15, duration: 0 });
          await new Promise<void>((r) => {
            requestAnimationFrame(() => requestAnimationFrame(() => r()));
          });
          const base = safeExportBasename(title);
          if (kind === "png") {
            const dataUrl = await captureViewportToPngDataUrl(viewportEl);
            downloadPngFromDataUrl(dataUrl, `${base}.png`);
            store().showToast("已下載 PNG");
          } else {
            // PDF 走高解析位圖，提升文字與線條清晰度。
            const dataUrl = await captureViewportToPngDataUrl(viewportEl, {
              pixelRatio: 4,
            });
            await downloadPdfFromPngDataUrl(dataUrl, `${base}.pdf`, {
              orientation: pdfOrientation,
            });
            store().showToast(
              pdfOrientation === "portrait"
                ? "已下載 PDF（直式 A4）"
                : "已下載 PDF（橫式 A4）",
            );
          }
        } catch {
          store().showToast(kind === "png" ? "PNG 匯出失敗" : "PDF 匯出失敗");
        } finally {
          if (relayoutForPdf) {
            flushSync(() =>
              useCausalStore.setState({
                layoutDirection: prevDirection,
                nodes: prevNodes,
              }),
            );
          }
          void setViewport(prevViewport, { duration: 0 });
          store().setExporting(false);
        }
      },
    };
  }, [fitView, flowWrapRef, getViewport, screenToFlowPosition, setCenter, setViewport]);
}
