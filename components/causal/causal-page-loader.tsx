"use client";

import dynamic from "next/dynamic";

const CausalFlowApp = dynamic(
  () =>
    import("@/components/causal/causal-flow-app").then((m) => m.CausalFlowApp),
  { ssr: false, loading: () => <PageLoading /> },
);

function PageLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--causal-canvas)]">
      <p className="causal-ui text-sm text-[var(--causal-ink-muted)]">
        載入畫布…
      </p>
    </div>
  );
}

export function CausalPageLoader() {
  return <CausalFlowApp />;
}
