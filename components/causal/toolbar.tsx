"use client";

import { ChevronDown, ChevronUp, Plus, SlidersHorizontal } from "lucide-react";
import { useCausalStore } from "@/lib/store/causal-store";
import { FileSidebar } from "./file-sidebar";
import {
  cardClass,
  chipClass,
  modKeyLabel,
  POLARITY_OPTIONS,
  shellBtn,
  shellBtnPrimary,
} from "./ui-classes";
import type { CausalCommands } from "./use-causal-commands";

const detailsClass =
  "group rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] [&_summary::-webkit-details-marker]:hidden";

const summaryClass =
  "causal-ui flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium text-[var(--causal-ink)] marker:content-none";

type ToolsProps = {
  toolsCollapsed: boolean;
  onToolsCollapsedChange: (collapsed: boolean) => void;
  commands: CausalCommands;
  onNewFile: () => void;
  onImportFile: () => void;
  onOpenJsonEditor: () => void;
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
};

export function Toolbar(
  props: ToolsProps & {
    sidebarCollapsed: boolean;
    onSidebarCollapsedChange: (collapsed: boolean) => void;
    withFit: (fn: () => void) => void;
  },
) {
  const { sidebarCollapsed, onSidebarCollapsedChange, withFit, ...tools } = props;
  return (
    <>
      <FileSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={onSidebarCollapsedChange}
        withFit={withFit}
      />
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-end gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <ToolsPanel {...tools} />
        </div>
      </header>
    </>
  );
}

function ToolsPanel({
  toolsCollapsed: collapsed,
  onToolsCollapsedChange: setCollapsed,
  commands,
  onNewFile,
  onImportFile,
  onOpenJsonEditor,
  onOpenPalette,
  onOpenShortcuts,
}: ToolsProps) {
  const layoutDirection = useCausalStore((s) => s.layoutDirection);
  const canUndo = useCausalStore((s) => s.history.past.length > 0);
  const canRedo = useCausalStore((s) => s.history.future.length > 0);
  const exporting = useCausalStore((s) => s.exporting);
  const defaultPolarity = useCausalStore((s) => s.defaultPolarity);
  const setDefaultPolarity = useCausalStore((s) => s.setDefaultPolarity);
  const mod = modKeyLabel();

  if (collapsed) {
    return (
      <div className={`flex flex-col gap-1.5 p-1.5 ${cardClass}`}>
        <button
          type="button"
          onClick={commands.addNodeAtCenter}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--causal-accent)] text-white shadow-sm transition hover:opacity-90"
          title="新增節點"
          aria-label="新增節點"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] text-[var(--causal-ink)] transition hover:bg-black/[0.05]"
          title="展開工具"
          aria-expanded={false}
          aria-label="展開工具"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className={`w-[min(calc(100vw-1.5rem),17.5rem)] ${cardClass}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2">
        <span className="causal-ui text-xs font-medium tracking-wide text-[var(--causal-ink-muted)]">
          工具
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="causal-ui flex h-8 w-8 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]"
          aria-label="收合工具列"
          title="收合"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(70vh,calc(100dvh-8rem))] space-y-2.5 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={commands.addNodeAtCenter} className={shellBtnPrimary}>
            新增節點
          </button>
          <button type="button" onClick={commands.autoLayout} className={shellBtn} title={`${mod}+L`}>
            一鍵排版
          </button>
          <button
            type="button"
            onClick={commands.toggleOrientation}
            title={
              layoutDirection === "LR"
                ? "橫式版面：改為直式並重新排版"
                : "直式版面：改為橫式並重新排版"
            }
            className={shellBtn}
          >
            {layoutDirection === "LR" ? "切直式" : "切橫式"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={!canUndo} onClick={commands.undo} className={shellBtn} title={`${mod}+Z`}>
            復原
          </button>
          <button type="button" disabled={!canRedo} onClick={commands.redo} className={shellBtn} title={`${mod}+Shift+Z`}>
            重做
          </button>
          <button type="button" onClick={onNewFile} className={shellBtn}>
            新檔案
          </button>
          {onOpenPalette && (
            <button type="button" onClick={onOpenPalette} className={shellBtn}>
              命令 {mod}K
            </button>
          )}
          {onOpenShortcuts && (
            <button type="button" onClick={onOpenShortcuts} className={shellBtn}>
              快捷鍵 ?
            </button>
          )}
        </div>

        <details open className={detailsClass}>
          <summary className={summaryClass}>
            <span>匯入／匯出 JSON</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
            <button type="button" onClick={onImportFile} className={shellBtn}>
              匯入 JSON
            </button>
            <button type="button" onClick={commands.exportJson} className={shellBtn}>
              匯出 JSON
            </button>
            <button type="button" onClick={onOpenJsonEditor} className={shellBtn}>
              查看／編輯 JSON
            </button>
          </div>
        </details>

        <details open className={detailsClass}>
          <summary className={summaryClass}>
            <span>匯出圖檔</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("png")} className={shellBtn}>
              匯出 PNG 圖檔
            </button>
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("pdf", "portrait")} className={shellBtn}>
              匯出 PDF（直式 A4）
            </button>
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("pdf", "landscape")} className={shellBtn}>
              匯出 PDF（橫式 A4）
            </button>
          </div>
        </details>

        <div>
          <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
            新連線預設
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {POLARITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={defaultPolarity === o.value}
                onClick={() => setDefaultPolarity(o.value)}
                className={chipClass(defaultPolarity === o.value, o.activeClass)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
