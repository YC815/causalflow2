"use client";

import { useReactFlow } from "@xyflow/react";
import {
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCausalStore } from "@/lib/store/causal-store";
import { useFilesStore } from "@/lib/store/files-store";
import { displayTitle, type FileMeta, sortByRecent } from "@/lib/store/files";
import { ConfirmDialog } from "./confirm-dialog";
import { cardClass, shellBtnPrimary } from "./ui-classes";
import { useStoredFlag } from "./use-stored-flag";

const LS_SIDEBAR = "causalflow-ui-sidebar-collapsed";

const timeFormat = new Intl.DateTimeFormat("zh-TW", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const iconBtn =
  "causal-ui nodrag nopan flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]";

export function FileSidebar() {
  const formId = useId();
  const { fitView } = useReactFlow();
  const files = useFilesStore((s) => s.files);
  const activeId = useFilesStore((s) => s.activeId);
  const title = useCausalStore((s) => s.title);
  const setTitle = useCausalStore((s) => s.setTitle);
  const commit = useCausalStore((s) => s.commit);
  const dirtyRef = useRef(false);
  const [collapsed, setCollapsed] = useStoredFlag(LS_SIDEBAR, false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FileMeta | null>(null);

  // 切換／新增後讓新圖入鏡
  const afterSwitch = (ok: boolean) => {
    if (ok) {
      requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 0 }));
    }
  };

  const open = (id: string) => {
    if (id !== activeId) afterSwitch(useFilesStore.getState().openFile(id));
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="causal-ui nodrag nopan group absolute left-3 top-3 z-10 flex max-w-[min(16rem,calc(100vw-1.5rem))] items-center gap-2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 py-2 pl-3 pr-3 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md transition hover:border-[var(--causal-accent)] hover:shadow-lg"
        aria-expanded={false}
        aria-label="展開檔案側邊欄"
      >
        <PanelLeftOpen className="h-4 w-4 shrink-0 text-[var(--causal-ink-muted)] transition group-hover:text-[var(--causal-accent)]" />
        <span className="truncate text-sm font-medium text-[var(--causal-ink)]">
          {displayTitle(title)}
        </span>
      </button>
    );
  }

  return (
    <div
      role="navigation"
      aria-label="檔案"
      className={`absolute bottom-3 left-3 top-3 z-10 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col ${cardClass}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
        <h1 className="causal-display text-lg leading-tight tracking-tight text-[var(--causal-ink)]">
          CausalFlow
        </h1>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className={iconBtn}
          aria-label="收合側邊欄"
          title="收合"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-2">
        <label htmlFor={`${formId}-title`} className="sr-only">
          目前檔名
        </label>
        <input
          id={`${formId}-title`}
          value={title}
          onFocus={() => {
            dirtyRef.current = false;
          }}
          onChange={(e) => {
            if (!dirtyRef.current) {
              commit();
              dirtyRef.current = true;
            }
            setTitle(e.target.value);
          }}
          placeholder="圖標題（可選）"
          className="causal-ui nodrag nopan w-full rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2.5 py-1.5 text-sm text-[var(--causal-ink)] placeholder:text-[var(--causal-ink-muted)]"
        />
        <button
          type="button"
          onClick={() => afterSwitch(useFilesStore.getState().createFile() !== null)}
          className={`nodrag nopan w-full ${shellBtnPrimary}`}
        >
          ＋ 新檔案
        </button>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t border-[var(--causal-node-border)] p-1.5">
        {sortByRecent(files).map((file) => (
          <FileRow
            key={file.id}
            file={file}
            active={file.id === activeId}
            renaming={file.id === renamingId}
            onOpen={() => open(file.id)}
            onStartRename={() => setRenamingId(file.id)}
            onEndRename={() => setRenamingId(null)}
            onDuplicate={() =>
              afterSwitch(useFilesStore.getState().duplicateFile(file.id) !== null)
            }
            onDelete={() => setDeleting(file)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={`刪除『${deleting ? displayTitle(deleting.title) : ""}』？`}
        description="刪除後無法復原。"
        confirmLabel="刪除"
        onConfirm={() => {
          if (!deleting) return;
          const before = useFilesStore.getState().activeId;
          useFilesStore.getState().deleteFile(deleting.id);
          afterSwitch(useFilesStore.getState().activeId !== before);
        }}
      />
    </div>
  );
}

function FileRow({
  file,
  active,
  renaming,
  onOpen,
  onStartRename,
  onEndRename,
  onDuplicate,
  onDelete,
}: {
  file: FileMeta;
  active: boolean;
  renaming: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onEndRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-1 rounded-lg ${
        active ? "bg-[var(--causal-accent-muted)]" : "hover:bg-black/[0.04]"
      }`}
    >
      {renaming ? (
        <RenameInput
          initial={file.title}
          onSubmit={(value) => {
            if (value !== file.title) {
              useFilesStore.getState().renameFile(file.id, value);
            }
          }}
          onDone={onEndRename}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={onOpen}
            aria-current={active ? "true" : undefined}
            className="causal-ui nodrag nopan min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
          >
            <span className="block truncate text-sm text-[var(--causal-ink)]">
              {displayTitle(file.title)}
            </span>
            <span className="block text-[10px] text-[var(--causal-ink-muted)]">
              {timeFormat.format(file.updatedAt)}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${iconBtn} mr-1`}
                aria-label={`「${displayTitle(file.title)}」的選項`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="causal-ui"
              // 避免關閉選單後焦點跳回觸發鈕，搶走重新命名輸入框的焦點
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem onSelect={onStartRename}>
                重新命名
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                建立副本
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                刪除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );
}

/** Enter／blur 確認、Esc 取消 */
function RenameInput({
  initial,
  onSubmit,
  onDone,
}: {
  initial: string;
  onSubmit: (value: string) => void;
  onDone: () => void;
}) {
  const cancelledRef = useRef(false);
  return (
    <input
      autoFocus
      defaultValue={initial}
      aria-label="重新命名檔案"
      placeholder="未命名"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelledRef.current = true;
          onDone();
        }
      }}
      onBlur={(e) => {
        if (!cancelledRef.current) onSubmit(e.currentTarget.value);
        onDone();
      }}
      className="causal-ui nodrag nopan m-1 min-w-0 flex-1 rounded-md border border-[var(--causal-accent)] bg-[var(--causal-paper-2)] px-2 py-1 text-sm text-[var(--causal-ink)]"
    />
  );
}
