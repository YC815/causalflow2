"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export type CausalNodeData = {
  label: string;
};

export function CausalNode({
  data,
  selected,
}: NodeProps<Node<CausalNodeData, "causal">>) {
  return (
    <div
      className={[
        "causal-node min-w-[7rem] max-w-[14rem] rounded-lg border-2 px-4 py-3 text-center shadow-sm transition-[box-shadow,transform]",
        selected
          ? "border-[var(--causal-accent)] shadow-[0_0_0_3px_var(--causal-accent-muted)]"
          : "border-[var(--causal-node-border)]",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-[var(--causal-paper)]"
      />
      <p className="causal-serif text-[0.95rem] leading-snug text-[var(--causal-ink)]">
        {data.label}
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-[var(--causal-paper)]"
      />
    </div>
  );
}
