"use client";

import { useState } from "react";

/** localStorage 記住的布林 UI 狀態（收合等）。元件只在 client 端渲染。 */
export function useStoredFlag(
  key: string,
  initial: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [value, update];
}
