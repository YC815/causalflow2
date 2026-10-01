"use client";

import { useId, useRef, useState } from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import { chipClass, POLARITY_OPTIONS } from "./ui-classes";

function NodeLabelField({ id, label }: { id: string; label: string }) {
  const fieldId = useId();
  const commit = useCausalStore((s) => s.commit);
  const updateNodeLabel = useCausalStore((s) => s.updateNodeLabel);
  const restoreLabel = useCausalStore((s) => s.restoreLabel);
  // 聚焦期間顯示草稿；空白不寫回 store，避免存出空 label
  const [draft, setDraft] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const originalRef = useRef(label);

  return (
    <>
      <label htmlFor={fieldId} className="sr-only">
        節點文字
      </label>
      <textarea
        id={fieldId}
        value={draft ?? label}
        onFocus={() => {
          setDraft(label);
          originalRef.current = label;
          dirtyRef.current = false;
        }}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (!value.trim()) return;
          if (!dirtyRef.current) {
            commit();
            dirtyRef.current = true;
          }
          updateNodeLabel(id, value);
        }}
        onBlur={() => {
          // 清空後失焦：退回聚焦時的 label，不留下中途的殘缺字串
          if (dirtyRef.current && !draft?.trim()) {
            restoreLabel(id, originalRef.current);
          }
          setDraft(null);
        }}
        rows={3}
        className="causal-ui mt-1.5 w-full resize-y rounded-lg border border-[var(--causal-node-border)] bg-white px-2 py-1.5 text-sm text-[var(--causal-ink)]"
      />
    </>
  );
}

export function Inspector() {
  const selectedNode = useCausalStore(
    (s) => s.nodes.find((n) => n.selected) ?? null,
  );
  const selectedEdge = useCausalStore((s) =>
    s.nodes.some((n) => n.selected)
      ? null
      : (s.edges.find((e) => e.selected) ?? null),
  );
  const updateEdge = useCausalStore((s) => s.updateEdge);
  const reverseEdge = useCausalStore((s) => s.reverseEdge);

  if (selectedNode) {
    return (
      <div className="border-t border-[var(--causal-node-border)] pt-2.5">
        <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
          選中節點
        </p>
        <NodeLabelField
          key={selectedNode.id}
          id={selectedNode.id}
          label={selectedNode.data.label}
        />
      </div>
    );
  }

  if (!selectedEdge) return null;
  const polarity = selectedEdge.data?.polarity ?? "positive";
  const bidirectional = selectedEdge.data?.bidirectional ?? false;
  return (
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
            updateEdge(selectedEdge.id, { bidirectional: !bidirectional })
          }
          className={chipClass(false, "")}
        >
          {bidirectional ? "改單向" : "改雙向"}
        </button>
        {POLARITY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => updateEdge(selectedEdge.id, { polarity: o.value })}
            className={chipClass(polarity === o.value, o.activeClass)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => reverseEdge(selectedEdge.id)}
          className={chipClass(false, "")}
        >
          反轉方向
        </button>
      </div>
    </div>
  );
}
