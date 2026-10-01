"use client";

import { useSyncExternalStore } from "react";
import { Kbd } from "@/components/ui/kbd";
import { type PanelState, panelInsets } from "@/lib/panel-insets";
import { useCausalStore } from "@/lib/store/causal-store";
import { cardClass, modKeyLabel, shellBtnPrimary } from "./ui-classes";

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const windowWidth = () => window.innerWidth;

/**
 * 空畫布引導：目前檔案沒有節點時顯示在兩側面板之間的可見區中央。
 * 整層 pointer-events-none，雙擊／右鍵／拖曳都落到底下的 pane；只有按鈕可點。
 */
export function EmptyCanvasHint({
  panels,
  onAddNode,
}: {
  panels: PanelState;
  onAddNode: () => void;
}) {
  const empty = useCausalStore((s) => s.nodes.length === 0);
  const exporting = useCausalStore((s) => s.exporting);
  const width = useSyncExternalStore(subscribeResize, windowWidth, () => 0);
  if (!empty || exporting) return null;

  const insets = panelInsets(width, panels);
  const mod = modKeyLabel();
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-4"
      style={{
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
        paddingTop: insets.top + 16,
      }}
    >
      <div
        className={`causal-ui w-full max-w-sm px-5 py-4 text-sm text-[var(--causal-ink)] ${cardClass}`}
      >
        <p className="mb-2 font-medium">從這裡開始</p>
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-[var(--causal-ink-muted)]">
          <li>雙擊空白處（或按「新增節點」）建立第一個節點</li>
          <li>
            拖曳節點側邊的圓點：放到另一節點＝連線，放到空白處＝新增相連節點
          </li>
          <li>
            選取節點後按 <Kbd>Tab</Kbd> 建立下游、<Kbd>Enter</Kbd> 建立同層
          </li>
          <li>
            按 <Kbd>?</Kbd> 查看所有快捷鍵，<Kbd>{mod}</Kbd>
            <Kbd>K</Kbd> 開命令面板
          </li>
        </ul>
        <button
          type="button"
          onClick={onAddNode}
          className={`pointer-events-auto mt-3 px-3 ${shellBtnPrimary}`}
        >
          新增第一個節點
        </button>
      </div>
    </div>
  );
}
