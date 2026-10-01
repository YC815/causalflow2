"use client";

import { useLayoutEffect, useRef } from "react";
import { ArrowLeftRight, ArrowUpDown } from "lucide-react";
import {
  Handle,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useCausalStore } from "@/lib/store/causal-store";
import { useCausalFlowOrientation } from "./causal-orientation-context";
import { shellBtn } from "./ui-classes";

export type CausalNodeData = {
  label: string;
  flipped?: boolean;
};

function NodeLabelEditor({ initial }: { initial: string }) {
  const finishEditing = useCausalStore((s) => s.finishEditing);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    // 新節點量測完成前是 visibility:hidden，此時 focus() 會失敗；每 30ms 重試直到成功
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    let tries = 0;
    const tryFocus = () => {
      el.focus({ preventScroll: true });
      if (document.activeElement === el) {
        el.select();
        return;
      }
      if (++tries < 40) timer = window.setTimeout(tryFocus, 30);
    };
    tryFocus();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      rows={1}
      aria-label="節點文字"
      className="nodrag nopan nowheel causal-ui block w-full min-w-[6rem] resize-none bg-transparent text-center text-[0.95rem] leading-snug text-[var(--causal-ink)] outline-none [field-sizing:content]"
      onKeyDown={(e) => {
        // 中文輸入法選字時的 Enter 不算確認
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finishEditing(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finishEditing(null);
        }
      }}
      onBlur={(e) => finishEditing(e.currentTarget.value)}
    />
  );
}

export function CausalNode({
  id,
  data,
  selected,
}: NodeProps<Node<CausalNodeData, "causal">>) {
  const orientation = useCausalFlowOrientation();
  const updateNodeInternals = useUpdateNodeInternals();
  const editing = useCausalStore((s) => s.editing?.id === id);
  const exporting = useCausalStore((s) => s.exporting);
  const toggleFlip = useCausalStore((s) => s.toggleFlip);
  const onlySelected = useCausalStore(
    (s) => s.nodes.filter((n) => n.selected).length === 1,
  );
  const flipped = Boolean(data.flipped);
  const horizontal = orientation === "horizontal";
  const inSide = horizontal ? Position.Left : Position.Top;
  const outSide = horizontal ? Position.Right : Position.Bottom;
  // 翻轉：輸入／輸出兩側對調
  const inPos = flipped ? outSide : inSide;
  const outPos = flipped ? inSide : outSide;
  const FlipIcon = horizontal ? ArrowLeftRight : ArrowUpDown;

  /** Handle 位置變更後通知 React Flow 重算連線端點，否則邊仍沿用舊的左右座標 */
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, orientation, flipped, updateNodeInternals]);

  return (
    <div
      className={[
        "causal-node min-w-[7rem] max-w-[14rem] rounded-lg border-2 bg-white px-4 py-3 text-center shadow-sm transition-[box-shadow,transform]",
        selected || editing
          ? "border-[var(--causal-accent)] shadow-[0_0_0_3px_var(--causal-accent-muted)]"
          : "border-[var(--causal-node-border)]",
      ].join(" ")}
    >
      <NodeToolbar
        position={Position.Top}
        isVisible={Boolean(selected) && !editing && !exporting && onlySelected}
      >
        <button
          type="button"
          title="翻轉輸入／輸出（F）"
          aria-label="翻轉輸入／輸出（F）"
          className={`${shellBtn} nodrag nopan`}
          onClick={(e) => {
            toggleFlip([id]);
            // 釋放焦點，讓 F 快捷鍵繼續有效
            e.currentTarget.blur();
          }}
        >
          <FlipIcon className="size-3.5" />
        </button>
      </NodeToolbar>
      <Handle
        id="in"
        type="source"
        position={inPos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
      {editing ? (
        <NodeLabelEditor initial={data.label} />
      ) : (
        <p className="causal-ui whitespace-pre-wrap text-[0.95rem] leading-snug text-[var(--causal-ink)]">
          {data.label}
        </p>
      )}
      <Handle
        id="out"
        type="source"
        position={outPos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
    </div>
  );
}
