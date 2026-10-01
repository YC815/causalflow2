"use client";

import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
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
  useRef,
  useState,
} from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import { CausalEdge } from "./causal-edge";
import { CausalNode } from "./causal-node";
import { CausalOrientationProvider } from "./causal-orientation-context";
import { JsonEditorDialog } from "./json-editor-dialog";
import { JsonGuidePanel } from "./json-guide-panel";
import { Toolbar } from "./toolbar";
import { hydrateFromStorage, useAutosave } from "./use-autosave";
import { useCausalCommands } from "./use-causal-commands";
import { useStoredFlag } from "./use-stored-flag";

const nodeTypes = { causal: CausalNode };
const edgeTypes = { causal: CausalEdge };
const LS_MINIMAP = "causalflow-ui-minimap-hidden";

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

function FlowCanvas() {
  useAutosave();
  const nodes = useCausalStore((s) => s.nodes);
  const edges = useCausalStore((s) => s.edges);
  const layoutDirection = useCausalStore((s) => s.layoutDirection);
  const toast = useCausalStore((s) => s.toast);
  const onNodesChange = useCausalStore((s) => s.onNodesChange);
  const onEdgesChange = useCausalStore((s) => s.onEdgesChange);
  const connect = useCausalStore((s) => s.connect);
  const commit = useCausalStore((s) => s.commit);
  const showToast = useCausalStore((s) => s.showToast);

  const flowWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commands = useCausalCommands(flowWrapRef);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [minimapHidden, setMinimapHidden] = useStoredFlag(LS_MINIMAP, false);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || !state.fromNode || !isPaneTarget(event.target)) {
        return;
      }
      commands.addConnectedNodeAtScreen(
        state.fromNode.id,
        clientPoint(event),
        state.fromHandle?.type === "target" ? "upstream" : "downstream",
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
    const err = commands.importText(await file.text());
    showToast(err ?? "已匯入 JSON");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative h-[100dvh] w-full">
      <CausalOrientationProvider
        orientation={layoutDirection === "LR" ? "horizontal" : "vertical"}
      >
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
            onConnect={(c) => {
              if (c.source && c.target) connect(c.source, c.target);
            }}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={() => commit()}
            onSelectionDragStart={() => commit()}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => {
              if (ns.length > 0 || es.length > 0) commit();
              return true;
            }}
            onNodeDoubleClick={(_, node) => commands.editNode(node.id)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
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
              className="!border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md [&_button]:!fill-[var(--causal-ink)]"
              showInteractive={false}
            >
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
                style={{ marginLeft: 56 }}
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
      </CausalOrientationProvider>

      <Toolbar
        commands={commands}
        onImportFile={() => fileInputRef.current?.click()}
        onOpenJsonEditor={() => setJsonEditorOpen(true)}
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
  // 整個 app 只在 client 端渲染（causal-page-loader 使用 ssr:false），可同步讀 localStorage
  useState(hydrateFromStorage);
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
