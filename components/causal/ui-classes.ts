import type { CausalPolarity } from "@/lib/causal-json";

export const shellBtn =
  "causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2 py-1.5 text-xs text-[var(--causal-ink)] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export const shellBtnPrimary =
  "causal-ui rounded-lg bg-[var(--causal-accent)] px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const POLARITY_OPTIONS: {
  value: CausalPolarity;
  label: string;
  activeClass: string;
}[] = [
  { value: "positive", label: "正", activeClass: "bg-[var(--causal-edge-pos-muted)]" },
  { value: "negative", label: "負", activeClass: "bg-[var(--causal-edge-neg-muted)]" },
  { value: "neutral", label: "未指定", activeClass: "bg-[var(--causal-edge-neutral-muted)]" },
];

export function chipClass(active: boolean, activeClass: string): string {
  return `causal-ui rounded-md px-2 py-1 text-[11px] ${
    active
      ? `${activeClass} text-[var(--causal-ink)]`
      : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
  }`;
}

/** 快捷鍵顯示用：Mac 顯示 ⌘，其餘 Ctrl */
export function modKeyLabel(): string {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
}
