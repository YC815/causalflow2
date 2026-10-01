"use client";

import { useCallback, useState } from "react";
import {
  CAUSAL_JSON_AI_GUIDE,
  CAUSAL_JSON_NOTEBOOKLM_WARNING,
} from "@/lib/causal-json";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** 開啟入口在工具面板「匯入／匯出」選單與命令面板，這裡只負責顯示 */
export function JsonGuidePanel({ open, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CAUSAL_JSON_AI_GUIDE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  if (!open) return null;

  // z-40：低於 radix Dialog／DropdownMenu（z-50），不會蓋住命令面板等遮罩
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-full flex-col items-end gap-2 pl-8">
      <div className="pointer-events-auto flex max-h-[min(70vh,32rem)] w-[min(calc(100vw-2rem),22rem)] flex-col overflow-hidden rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)] shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2">
          <span className="causal-ui text-xs font-medium tracking-wide text-[var(--causal-ink-muted)]">
            給 AI 的格式說明
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={copy}
              className="causal-ui rounded-md px-2 py-1 text-xs text-[var(--causal-accent)] hover:bg-[var(--causal-accent-muted)]"
            >
              {copied ? "已複製" : "複製全文"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="causal-ui rounded-md px-2 py-1 text-xs text-[var(--causal-ink-muted)] hover:bg-black/5"
              aria-label="關閉"
            >
              關閉
            </button>
          </div>
        </div>
        <div className="causal-ui border-b border-[var(--causal-node-border)] bg-[var(--causal-edge-neg-muted)]/40 px-3 py-2 text-[11px] leading-relaxed text-[var(--causal-ink)]">
          {CAUSAL_JSON_NOTEBOOKLM_WARNING}
        </div>
        <pre className="causal-mono flex-1 overflow-auto p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--causal-ink)]">
          {CAUSAL_JSON_AI_GUIDE}
        </pre>
      </div>
    </div>
  );
}
