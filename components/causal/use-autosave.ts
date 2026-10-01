"use client";

import { useEffect } from "react";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import { useCausalStore } from "@/lib/store/causal-store";
import {
  loadStoredDocument,
  loadStoredLayout,
  saveStoredDocument,
  saveStoredLayout,
  type StorageLike,
} from "@/lib/store/persistence";
import { flowToDocument } from "./flow-adapters";

const SAVE_DEBOUNCE_MS = 500;

const unavailableStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error("localStorage unavailable");
  },
};

/** 隱私模式下存取 window.localStorage 本身就可能丟例外 */
function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
}

export function hydrateFromStorage(): void {
  const storage = browserStorage();
  const { doc, status } = loadStoredDocument(storage, SAMPLE_CAUSAL_DOCUMENT);
  const store = useCausalStore.getState();
  store.replaceDocument(doc, loadStoredLayout(storage));
  if (status === "corrupt") {
    store.showToast("存檔損毀，已載入範例（原資料已備份）");
  }
}

export function useAutosave(): void {
  useEffect(() => {
    const storage = browserStorage();
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
      const { nodes, edges, title, layoutDirection, showToast } =
        useCausalStore.getState();
      const ok = saveStoredDocument(
        storage,
        flowToDocument(nodes, edges, title.trim() || undefined),
      );
      saveStoredLayout(storage, layoutDirection);
      if (!ok && !warned) {
        warned = true;
        showToast("無法自動存檔");
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
