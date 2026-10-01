"use client";

import { useEffect } from "react";
import {
  type CausalJsonDocument,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import type { ArrowDirection } from "@/lib/navigation";
import { useCausalStore } from "@/lib/store/causal-store";
import type { CausalCommands } from "./use-causal-commands";

const ARROWS: Record<string, ArrowDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * 正在打字、焦點在按鈕／連結（Enter、Space 屬於它們）、或在對話框／選單內時，全域快捷鍵一律讓路。
 * 點畫布會把焦點移回 body，所以不影響畫布上的操作。
 */
function isOwnedByOtherUi(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a[href], summary, [contenteditable="true"], [role="dialog"], [role="menu"]',
    ) !== null
  );
}

export function useHotkeys(
  commands: CausalCommands,
  ui: { openPalette: () => void; openShortcuts: () => void },
): void {
  const { openPalette, openShortcuts } = ui;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (useCausalStore.getState().exporting) return;
      if (e.isComposing || isOwnedByOtherUi(e.target)) return;
      // 按住 Enter／Tab 會連環建節點；只有方向鍵允許連發
      if (e.repeat && !(e.key in ARROWS)) return;

      // 對「有做事才攔截」的鍵：handler 回傳 true 才 preventDefault
      const consume = (handled: boolean) => {
        if (handled) e.preventDefault();
      };

      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === "z" && e.shiftKey) return consume((commands.redo(), true));
        if (key === "z") return consume((commands.undo(), true));
        if (key === "y") return consume((commands.redo(), true));
        if (key === "k") return consume((openPalette(), true));
        if (key === "l") return consume((commands.autoLayout(), true));
        if (key === "d") return consume((commands.duplicate(), true));
        if (key === "a") return consume((commands.selectAll(), true));
        return;
      }
      if (e.altKey) return;

      if (e.key === "?") return consume((openShortcuts(), true));
      if (e.key === "Escape") return commands.clearSelection();
      if (e.key === "Tab" && !e.shiftKey) return consume(commands.createDownstream());
      if (e.key === "Enter") return consume(commands.createSibling());
      if (e.key === "F2" || e.key === " ") return consume(commands.editSelected());

      const arrow = ARROWS[e.key];
      if (arrow) return consume(commands.navigate(arrow));

      if (e.key === "+" || e.key === "=") {
        return consume(commands.setSelectedEdgePolarity("positive"));
      }
      if (e.key === "-") return consume(commands.setSelectedEdgePolarity("negative"));
      if (e.key === "0") return consume(commands.setSelectedEdgePolarity("neutral"));
    };

    // 走原生剪貼簿事件：讀取不需權限詢問，且可跨分頁貼上 CausalFlow JSON
    const onCopy = (e: ClipboardEvent) => {
      if (useCausalStore.getState().exporting) return;
      if (isOwnedByOtherUi(e.target)) return;
      const frag = commands.copySelection();
      if (!frag || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", stringifyCausalJson(frag));
    };

    const onCut = (e: ClipboardEvent) => {
      if (useCausalStore.getState().exporting) return;
      if (isOwnedByOtherUi(e.target)) return;
      const frag = commands.copySelection();
      if (!frag || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", stringifyCausalJson(frag));
      commands.deleteSelected();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (useCausalStore.getState().exporting) return;
      if (isOwnedByOtherUi(e.target)) return;
      let doc: CausalJsonDocument | null = null;
      try {
        doc = parseCausalJson(e.clipboardData?.getData("text/plain") ?? "");
      } catch {
        doc = null;
      }
      if (commands.pasteDocument(doc)) e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [commands, openPalette, openShortcuts]);
}
