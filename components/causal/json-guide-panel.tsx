"use client";

import { useCallback, useState } from "react";
import {
  CAUSAL_JSON_AI_GUIDE,
  CAUSAL_JSON_NOTEBOOKLM_WARNING,
} from "@/lib/causal-json";

export function JsonGuidePanel() {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-full flex-col items-end gap-2 pl-8">
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="causal-ui rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 px-3 py-2 text-xs text-[var(--causal-ink)] shadow-md ring-1 ring-black/[0.04] backdrop-blur-md transition hover:border-[var(--causal-accent)] hover:shadow-lg"
            title="開啟 JSON／AI 格式說明"
          >
            JSON／AI 指南
          </button>
        ) : (
          <div className="flex max-h-[min(70vh,32rem)] w-[min(calc(100vw-2rem),22rem)] flex-col overflow-hidden rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)] shadow-xl">
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
                  onClick={() => setOpen(false)}
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
        )}
      </div>
    </div>
  );
}
