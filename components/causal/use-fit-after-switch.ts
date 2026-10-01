"use client";

import { useCallback } from "react";
import { useFilesStore } from "@/lib/store/files-store";
import type { FitGraph } from "./use-fit-graph";

/** 執行會切換檔案的動作；目前檔案因此改變時，下一個 frame 讓新圖入鏡 */
export function useFitAfterSwitch(fitGraph: FitGraph): (fn: () => void) => void {
  return useCallback(
    (fn) => {
      const before = useFilesStore.getState().activeId;
      fn();
      if (useFilesStore.getState().activeId !== before) {
        requestAnimationFrame(() => void fitGraph({ duration: 0 }));
      }
    },
    [fitGraph],
  );
}
