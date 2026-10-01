"use client";

import { ChevronDown, ChevronUp, Plus, SlidersHorizontal } from "lucide-react";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** 面板底部的熟手入口：小字連結樣式 */
const footLinkClass =
  "causal-ui rounded px-1 py-0.5 text-[11px] text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]";

type ToolsProps = {
  toolsCollapsed: boolean;
  onToolsCollapsedChange: (collapsed: boolean) => void;
  commands: CausalCommands;
  onImportFile: () => void;
  onOpenJsonEditor: () => void;
  onOpenJsonGuide: () => void;
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
  onImportFile,
  onOpenJsonEditor,
  onOpenJsonGuide,
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
          <ImportExportMenu
            commands={commands}
            exporting={exporting}
            onImportFile={onImportFile}
            onOpenJsonEditor={onOpenJsonEditor}
            onOpenJsonGuide={onOpenJsonGuide}
          />
        </div>

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

      {(onOpenPalette || onOpenShortcuts) && (
        <div className="flex items-center gap-1 border-t border-[var(--causal-node-border)] px-2 py-1.5">
          {onOpenPalette && (
            <button type="button" onClick={onOpenPalette} className={footLinkClass}>
              {mod}K 命令面板
            </button>
          )}
          {onOpenPalette && onOpenShortcuts && (
            <span aria-hidden className="text-[11px] text-[var(--causal-ink-muted)]">·</span>
          )}
          {onOpenShortcuts && (
            <button type="button" onClick={onOpenShortcuts} className={footLinkClass}>
              ? 快捷鍵
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

/** 匯入／匯出與 JSON 相關動作收進同一個下拉選單，匯出中停用匯出項 */
function ImportExportMenu({
  commands,
  exporting,
  onImportFile,
  onOpenJsonEditor,
  onOpenJsonGuide,
}: Pick<ToolsProps, "commands" | "onImportFile" | "onOpenJsonEditor" | "onOpenJsonGuide"> & {
  exporting: boolean;
}) {
  // 選單是 modal：onSelect 當下 FocusScope 還在攔焦點，此時開浮層會被搶走焦點。
  // 所以一律先記下動作，等選單真正卸載（onCloseAutoFocus）後才執行。
  const pendingRef = useRef<(() => void) | null>(null);
  const later = (fn: () => void) => () => {
    pendingRef.current = fn;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`${shellBtn} inline-flex items-center gap-1`}>
          匯入／匯出
          <ChevronDown className="h-3.5 w-3.5 text-[var(--causal-ink-muted)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="causal-ui w-auto min-w-44"
        onCloseAutoFocus={(e) => {
          const run = pendingRef.current;
          pendingRef.current = null;
          if (!run) return;
          // 交給動作自己決定焦點（例如編輯框 autoFocus），不還給觸發鈕
          e.preventDefault();
          run();
        }}
      >
        <DropdownMenuItem onSelect={later(onImportFile)}>匯入 JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={later(commands.exportJson)}>匯出 JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={later(onOpenJsonEditor)}>查看／編輯 JSON</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={exporting} onSelect={later(() => void commands.exportImage("png"))}>
          匯出 PNG 圖檔
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onSelect={later(() => void commands.exportImage("pdf", "portrait"))}>
          匯出 PDF（直式 A4）
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onSelect={later(() => void commands.exportImage("pdf", "landscape"))}>
          匯出 PDF（橫式 A4）
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={later(onOpenJsonGuide)}>JSON／AI 格式說明</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
