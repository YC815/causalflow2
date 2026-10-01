"use client";

import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { useFilesStore } from "@/lib/store/files-store";

/** 執行會切換檔案的動作；目前檔案因此改變時，下一個 frame 讓新圖入鏡 */
export function useFitAfterSwitch(): (fn: () => void) => void {
  const { fitView } = useReactFlow();
  return useCallback(
    (fn) => {
      const before = useFilesStore.getState().activeId;
      fn();
      if (useFilesStore.getState().activeId !== before) {
        requestAnimationFrame(() => void fitView({ padding: 0.2, duration: 0 }));
      }
    },
    [fitView],
  );
}
