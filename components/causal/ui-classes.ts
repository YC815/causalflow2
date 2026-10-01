import type { CausalPolarity } from "@/lib/causal-json";

export const cardClass =
  "rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md";

export const shellBtn =
  "causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2 py-1.5 text-xs text-[var(--causal-ink)] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export const shellBtnPrimary =
  "causal-ui rounded-lg bg-[var(--causal-accent)] px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const POLARITY_OPTIONS: {
  value: CausalPolarity;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "positive",
    label: "正",
    activeClass:
      "border-[var(--causal-edge-pos)] bg-[var(--causal-edge-pos-muted)] text-[var(--causal-edge-pos)]",
  },
  {
    value: "negative",
    label: "負",
    activeClass:
      "border-[var(--causal-edge-neg)] bg-[var(--causal-edge-neg-muted)] text-[var(--causal-edge-neg)]",
  },
  {
    value: "neutral",
    label: "未指定",
    activeClass:
      "border-[var(--causal-edge-neutral)] bg-[var(--causal-edge-neutral-muted)] text-[var(--causal-edge-neutral)]",
  },
];

/** 未選也保留透明邊框，切換時尺寸不跳動；選中＝實色邊框＋加深底色與字色 */
export function chipClass(active: boolean, activeClass: string): string {
  return `causal-ui rounded-md border px-2 py-1 text-[11px] transition ${
    active
      ? `${activeClass} font-semibold`
      : "border-transparent bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)] hover:bg-black/[0.04] hover:text-[var(--causal-ink)]"
  }`;
}

/** 快捷鍵顯示用：Mac 顯示 ⌘，其餘 Ctrl */
export function modKeyLabel(): string {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
}
