"use client";

import { useState } from "react";

/**
 * localStorage 記住的布林 UI 狀態（收合等）。元件只在 client 端渲染。
 * initial 可傳函式：僅在使用者從未設定過時才求值（例如依視窗寬度決定預設）。
 */
export function useStoredFlag(
  key: string,
  initial: boolean | (() => boolean),
): [boolean, (value: boolean) => void] {
  const fallback = () => (typeof initial === "function" ? initial() : initial);
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback() : raw === "1";
    } catch {
      return fallback();
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
