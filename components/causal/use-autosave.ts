"use client";

import { useEffect } from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import type { FileStorage } from "@/lib/store/files";
import { useFilesStore } from "@/lib/store/files-store";

const SAVE_DEBOUNCE_MS = 500;

const unavailableStorage: FileStorage = {
  getItem: () => null,
  setItem: () => {
    throw new Error("localStorage unavailable");
  },
  removeItem: () => undefined,
};

/** 隱私模式下存取 window.localStorage 本身就可能丟例外 */
function browserStorage(): FileStorage {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
}

export function hydrateFromStorage(): void {
  const { corrupt } = useFilesStore.getState().init(browserStorage());
  const { showToast } = useCausalStore.getState();
  if (corrupt === "legacy") {
    showToast("存檔損毀，已載入範例（原資料已備份）");
  } else if (corrupt === "index") {
    showToast("檔案清單損毀，已重建（原資料已備份）");
  }
}

export function useAutosave(): void {
  useEffect(() => {
    // Fast Refresh 重建 files-store 模組後需要重新初始化
    if (useFilesStore.getState().activeId === null) hydrateFromStorage();
    let timer: number | undefined;
    let warned = false;

    const save = () => {
      window.clearTimeout(timer);
      timer = undefined;
      // 匯出 PDF 期間版面是暫時的，不能存；稍後重試
      if (useCausalStore.getState().exporting) {
        timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
        return;
      }
      const ok = useFilesStore.getState().saveActive();
      if (!ok && !warned) {
        warned = true;
        useCausalStore.getState().showToast("無法自動存檔");
      }
    };

    const unsubscribe = useCausalStore.subscribe((s, prev) => {
      if (
        s.nodes === prev.nodes &&
        s.edges === prev.edges &&
        s.title === prev.title &&
        s.layoutDirection === prev.layoutDirection
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
    });

    const flush = () => {
      if (timer !== undefined) save();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}
