"use client";

import { useLayoutEffect } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useCausalFlowOrientation } from "./causal-orientation-context";

export type CausalNodeData = {
  label: string;
};

export function CausalNode({
  id,
  data,
  selected,
}: NodeProps<Node<CausalNodeData, "causal">>) {
  const orientation = useCausalFlowOrientation();
  const updateNodeInternals = useUpdateNodeInternals();
  const targetPos =
    orientation === "horizontal" ? Position.Left : Position.Top;
  const sourcePos =
    orientation === "horizontal" ? Position.Right : Position.Bottom;

  /** Handle 位置變更後通知 React Flow 重算連線端點，否則邊仍沿用舊的左右座標 */
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, orientation, updateNodeInternals]);

  return (
    <div
      className={[
        "causal-node min-w-[7rem] max-w-[14rem] rounded-lg border-2 bg-white px-4 py-3 text-center shadow-sm transition-[box-shadow,transform]",
        selected
          ? "border-[var(--causal-accent)] shadow-[0_0_0_3px_var(--causal-accent-muted)]"
          : "border-[var(--causal-node-border)]",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={targetPos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
      <p className="causal-ui text-[0.95rem] leading-snug text-[var(--causal-ink)]">
        {data.label}
      </p>
      <Handle
        type="source"
        position={sourcePos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
    </div>
  );
}
