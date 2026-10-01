"use client";

import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ConnectionMode,
  MiniMap,
  type OnConnectEnd,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Map as MapIcon } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { HandleSide } from "@/lib/causal-json";
import { isNarrowViewport } from "@/lib/panel-insets";
import { useCausalStore } from "@/lib/store/causal-store";
import { useFilesStore } from "@/lib/store/files-store";
import { CanvasContextMenu, type MenuTarget } from "./canvas-context-menu";
import { CausalEdge } from "./causal-edge";
import { CausalNode } from "./causal-node";
import { CausalOrientationProvider } from "./causal-orientation-context";
import { CommandPalette, type PaletteAction } from "./command-palette";
import { EmptyCanvasHint } from "./empty-canvas-hint";
import { JsonEditorDialog } from "./json-editor-dialog";
import { JsonGuidePanel } from "./json-guide-panel";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Toolbar } from "./toolbar";
import { modKeyLabel } from "./ui-classes";
import { hydrateFromStorage, useAutosave } from "./use-autosave";
import { useCausalCommands } from "./use-causal-commands";
import { useFitAfterSwitch } from "./use-fit-after-switch";
import { currentFitPadding, useFitGraph } from "./use-fit-graph";
import { useHotkeys } from "./use-hotkeys";
import { useStoredFlag } from "./use-stored-flag";

const nodeTypes = { causal: CausalNode };
const edgeTypes = { causal: CausalEdge };
const LS_SIDEBAR = "causalflow-ui-sidebar-collapsed";
const LS_MINIMAP = "causalflow-ui-minimap-hidden";
const LS_TOOLS = "causalflow-ui-tools-collapsed";
/** 從未設定過收合狀態時：窄螢幕預設收合 */
const collapsedByDefault = () => isNarrowViewport(window.innerWidth);

function asSide(h: string | null | undefined): HandleSide | undefined {
  return h === "in" || h === "out" ? h : undefined;
}

function clientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("changedTouches" in event) {
    const t = event.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function isPaneTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.classList.contains("react-flow__pane")
  );
}

/** 與 xyflow Controls 內建 Fit View 相同的圖示（未匯出，照抄） */
function FitViewIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30">
      <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
    </svg>
  );
}

function FlowCanvas() {
  useAutosave();
  const nodes = useCausalStore((s) => s.nodes);
  const edges = useCausalStore((s) => s.edges);
  const layoutDirection = useCausalStore((s) => s.layoutDirection);
  const toast = useCausalStore((s) => s.toast);
  const onNodesChange = useCausalStore((s) => s.onNodesChange);
  const onEdgesChange = useCausalStore((s) => s.onEdgesChange);
  const connect = useCausalStore((s) => s.connect);
  const reconnectEdge = useCausalStore((s) => s.reconnectEdge);
  const commit = useCausalStore((s) => s.commit);
  const showToast = useCausalStore((s) => s.showToast);

  const flowWrapRef = useRef<HTMLDivElement>(null);
  // 改接線頭時 React Flow 也會呼叫 onConnectEnd（早於 onReconnectEnd），此時絕不能建節點
  const reconnectingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useStoredFlag(
    LS_SIDEBAR,
    collapsedByDefault,
  );
  const [toolsCollapsed, setToolsCollapsed] = useStoredFlag(
    LS_TOOLS,
    collapsedByDefault,
  );
  const fitGraph = useFitGraph({ sidebarCollapsed, toolsCollapsed });
  // 只在首次入鏡時使用；之後的入鏡都走 fitGraph（呼叫當下才量視窗）
  const initialFitOptions = useMemo(
    () => ({ padding: currentFitPadding({ sidebarCollapsed, toolsCollapsed }) }),
    [sidebarCollapsed, toolsCollapsed],
  );
  const commands = useCausalCommands(flowWrapRef, fitGraph);
  const files = useFilesStore((s) => s.files);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [minimapHidden, setMinimapHidden] = useStoredFlag(LS_MINIMAP, false);
  const selectNodes = useCausalStore((s) => s.selectNodes);
  const selectEdge = useCausalStore((s) => s.selectEdge);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useHotkeys(commands, { openPalette, openShortcuts });

  const withFit = useFitAfterSwitch(fitGraph);
  const newFile = useCallback(
    () => withFit(commands.newFile),
    [withFit, commands],
  );
  const openFile = useCallback(
    (id: string) => withFit(() => void useFilesStore.getState().openFile(id)),
    [withFit],
  );

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const mod = modKeyLabel();
    return [
      { id: "add", label: "新增節點", run: commands.addNodeAtCenter },
      { id: "layout", label: "一鍵排版", shortcut: `${mod}L`, run: commands.autoLayout },
      { id: "orientation", label: "切換橫式／直式", run: commands.toggleOrientation },
      { id: "undo", label: "復原", shortcut: `${mod}Z`, run: commands.undo },
      { id: "redo", label: "重做", shortcut: `${mod}⇧Z`, run: commands.redo },
      { id: "flip", label: "翻轉選取節點的輸入／輸出", shortcut: "F", run: () => void commands.toggleFlipSelected() },
      { id: "import", label: "匯入 JSON", run: () => fileInputRef.current?.click() },
      { id: "export-json", label: "匯出 JSON", run: commands.exportJson },
      { id: "edit-json", label: "查看／編輯 JSON", run: () => setJsonEditorOpen(true) },
      { id: "export-png", label: "匯出 PNG", run: () => void commands.exportImage("png") },
      { id: "export-pdf-p", label: "匯出 PDF（直式 A4）", run: () => void commands.exportImage("pdf", "portrait") },
      { id: "export-pdf-l", label: "匯出 PDF（橫式 A4）", run: () => void commands.exportImage("pdf", "landscape") },
      { id: "new-file", label: "新檔案", run: newFile },
      { id: "json-guide", label: "JSON／AI 格式說明", run: () => setGuideOpen(true) },
      { id: "shortcuts", label: "快捷鍵一覽", shortcut: "?", run: openShortcuts },
    ];
  }, [commands, newFile, openShortcuts]);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (reconnectingRef.current) return;
      if (state.isValid || !state.fromNode || !isPaneTarget(event.target)) {
        return;
      }
      // 從輸入側接點拖出 = 新增上游原因；從輸出側拖出 = 新增下游
      const fromSide = asSide(state.fromHandle?.id) ?? "out";
      commands.addConnectedNodeAtScreen(
        state.fromNode.id,
        clientPoint(event),
        fromSide === "in" ? "upstream" : "downstream",
        fromSide,
      );
    },
    [commands],
  );

  const onWrapperDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if (!isPaneTarget(e.target)) return;
      commands.addNodeAtScreen({ x: e.clientX, y: e.clientY });
    },
    [commands],
  );

  const onFile = async (file: File | null) => {
    if (!file) return;
    // 成功時 importAsNewFile 自己會 toast
    const text = await file.text();
    let err: string | null = null;
    withFit(() => {
      err = commands.importAsNewFile(text);
    });
    if (err) showToast(err);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative h-[100dvh] w-full">
      <CausalOrientationProvider
        orientation={layoutDirection === "LR" ? "horizontal" : "vertical"}
      >
        <CanvasContextMenu target={menuTarget} commands={commands}>
        <div
          ref={flowWrapRef}
          className="h-full w-full min-h-0"
          onDoubleClick={onWrapperDoubleClick}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            connectionMode={ConnectionMode.Loose}
            onConnect={(c) => {
              if (c.source && c.target) {
                connect(c.source, c.target, {
                  source: asSide(c.sourceHandle),
                  target: asSide(c.targetHandle),
                });
              }
            }}
            onConnectEnd={onConnectEnd}
            edgesReconnectable
            onReconnect={(oldEdge, c) => reconnectEdge(oldEdge.id, c)}
            onReconnectStart={() => {
              reconnectingRef.current = true;
            }}
            onReconnectEnd={() => {
              // 延後清除，不依賴與 onConnectEnd 的呼叫順序
              setTimeout(() => {
                reconnectingRef.current = false;
              }, 0);
            }}
            onNodeDragStart={() => commit()}
            onSelectionDragStart={() => commit()}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => {
              if (ns.length > 0 || es.length > 0) commit();
              return true;
            }}
            onNodeDoubleClick={(_, node) => commands.editNode(node.id)}
            onNodeContextMenu={(_, node) => {
              if (!node.selected) selectNodes([node.id]);
              setMenuTarget(
                nodes.filter((n) => n.selected).length > 1 && node.selected
                  ? { kind: "selection" }
                  : { kind: "node" },
              );
            }}
            onSelectionContextMenu={() => setMenuTarget({ kind: "selection" })}
            onEdgeContextMenu={(_, edge) => {
              selectEdge(edge.id);
              setMenuTarget({ kind: "edge" });
            }}
            onPaneContextMenu={(e) =>
              setMenuTarget({ kind: "pane", screen: { x: e.clientX, y: e.clientY } })
            }
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={initialFitOptions}
            minZoom={0.35}
            maxZoom={1.6}
            zoomOnDoubleClick={false}
            deleteKeyCode={["Backspace", "Delete"]}
            panActivationKeyCode={null}
            disableKeyboardA11y
            className="!bg-transparent"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.1}
              color="var(--causal-dot)"
            />
            <Controls
              className={`!border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md [&_button]:!fill-[var(--causal-ink)] ${
                sidebarCollapsed ? "" : "sm:!ml-[283px]"
              }`}
              showInteractive={false}
              showFitView={false}
            >
              {/* 取代內建 Fit View：避開兩側面板 */}
              <ControlButton
                onClick={() => void fitGraph()}
                className="react-flow__controls-fitview"
                title="Fit View"
                aria-label="Fit View"
              >
                <FitViewIcon />
              </ControlButton>
              <ControlButton
                onClick={() => setMinimapHidden(!minimapHidden)}
                title={minimapHidden ? "顯示小地圖" : "隱藏小地圖"}
                aria-label={minimapHidden ? "顯示小地圖" : "隱藏小地圖"}
              >
                <MapIcon />
              </ControlButton>
            </Controls>
            {!minimapHidden && (
              <MiniMap
                position="bottom-left"
                style={{ marginLeft: sidebarCollapsed ? 56 : 324 }}
                pannable
                zoomable
                nodeColor="#ffffff"
                nodeStrokeColor="#c9bda8"
                maskColor="rgba(232, 223, 210, 0.65)"
                className="!border !border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md"
              />
            )}
          </ReactFlow>
        </div>
        </CanvasContextMenu>
      </CausalOrientationProvider>

      <EmptyCanvasHint
        panels={{ sidebarCollapsed, toolsCollapsed }}
        onAddNode={commands.addNodeAtCenter}
      />

      <Toolbar
        sidebarCollapsed={sidebarCollapsed}
        onSidebarCollapsedChange={setSidebarCollapsed}
        toolsCollapsed={toolsCollapsed}
        onToolsCollapsedChange={setToolsCollapsed}
        withFit={withFit}
        commands={commands}
        onImportFile={() => fileInputRef.current?.click()}
        onOpenJsonEditor={() => setJsonEditorOpen(true)}
        onOpenJsonGuide={() => setGuideOpen(true)}
        onOpenPalette={openPalette}
        onOpenShortcuts={openShortcuts}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {jsonEditorOpen && (
        <JsonEditorDialog
          commands={commands}
          onClose={() => setJsonEditorOpen(false)}
        />
      )}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={paletteActions}
        files={files}
        onOpenFile={openFile}
        onFocusNode={commands.focusNode}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {toast && (
        <div
          role="status"
          className="causal-ui absolute bottom-20 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)] px-4 py-2 text-sm text-[var(--causal-ink)] shadow-lg"
        >
          {toast}
        </div>
      )}

      <JsonGuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

export function CausalFlowApp() {
  // 整個 app 只在 client 端渲染（causal-page-loader 使用 ssr:false），可同步讀 localStorage
  useState(() => hydrateFromStorage());
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
