import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";
import {
  type CausalJsonDocument,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";

export const DOC_KEY = "causalflow-doc-v1";
export const CORRUPT_KEY = "causalflow-doc-v1-corrupt";
export const LAYOUT_KEY = "causalflow-layout-v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type LoadStatus = "loaded" | "empty" | "corrupt";

export function loadStoredDocument(
  storage: StorageLike,
  fallback: CausalJsonDocument,
): { doc: CausalJsonDocument; status: LoadStatus } {
  let raw: string | null;
  try {
    raw = storage.getItem(DOC_KEY);
  } catch {
    return { doc: fallback, status: "empty" };
  }
  if (raw === null) return { doc: fallback, status: "empty" };
  try {
    return { doc: parseCausalJson(raw), status: "loaded" };
  } catch {
    // 不直接覆蓋壞資料，先備份讓使用者有機會救回。
    try {
      storage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* ignore */
    }
    return { doc: fallback, status: "corrupt" };
  }
}

export function saveStoredDocument(
  storage: StorageLike,
  doc: CausalJsonDocument,
): boolean {
  try {
    storage.setItem(DOC_KEY, stringifyCausalJson(doc));
    return true;
  } catch {
    return false;
  }
}

export function loadStoredLayout(storage: StorageLike): CausalLayoutDirection {
  try {
    return storage.getItem(LAYOUT_KEY) === "TB" ? "TB" : "LR";
  } catch {
    return "LR";
  }
}

export function saveStoredLayout(
  storage: StorageLike,
  direction: CausalLayoutDirection,
): void {
  try {
    storage.setItem(LAYOUT_KEY, direction);
  } catch {
    /* ignore */
  }
}
