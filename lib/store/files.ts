import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";
import {
  type CausalJsonDocument,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { loadStoredDocument, loadStoredLayout } from "./persistence";

export type FileStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type FileMeta = { id: string; title: string; updatedAt: number };

export const INDEX_KEY = "causalflow-files-v1";
export const ACTIVE_KEY = "causalflow-active-file-v1";
export const fileDocKey = (id: string) => `causalflow-file-v1:${id}`;
export const fileLayoutKey = (id: string) => `causalflow-file-layout-v1:${id}`;
export const UNTITLED = "未命名";

export function displayTitle(title: string): string {
  const t = title.trim();
  return t === "" ? UNTITLED : title;
}

export function sortByRecent(files: FileMeta[]): FileMeta[] {
  return [...files].sort((a, b) => b.updatedAt - a.updatedAt);
}

function isFileMeta(v: unknown): v is FileMeta {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.title === "string" &&
    typeof m.updatedAt === "number" &&
    Number.isFinite(m.updatedAt)
  );
}

export function loadIndex(storage: FileStorage): FileMeta[] {
  try {
    const raw = storage.getItem(INDEX_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFileMeta) : [];
  } catch {
    return [];
  }
}

export function saveIndex(storage: FileStorage, files: FileMeta[]): boolean {
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(files));
    return true;
  } catch {
    return false;
  }
}

export function readFileDoc(
  storage: FileStorage,
  id: string,
): CausalJsonDocument | null {
  let raw: string | null;
  try {
    raw = storage.getItem(fileDocKey(id));
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return parseCausalJson(raw);
  } catch {
    // 不直接覆蓋壞資料，先備份讓使用者有機會救回。
    try {
      storage.setItem(`${fileDocKey(id)}-corrupt`, raw);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeFileDoc(
  storage: FileStorage,
  id: string,
  doc: CausalJsonDocument,
): boolean {
  try {
    storage.setItem(fileDocKey(id), stringifyCausalJson(doc));
    return true;
  } catch {
    return false;
  }
}

export function readFileLayout(
  storage: FileStorage,
  id: string,
): CausalLayoutDirection {
  try {
    return storage.getItem(fileLayoutKey(id)) === "TB" ? "TB" : "LR";
  } catch {
    return "LR";
  }
}

export function writeFileLayout(
  storage: FileStorage,
  id: string,
  dir: CausalLayoutDirection,
): void {
  try {
    storage.setItem(fileLayoutKey(id), dir);
  } catch {
    /* ignore */
  }
}

export function removeFile(storage: FileStorage, id: string): void {
  for (const key of [fileDocKey(id), fileLayoutKey(id)]) {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function backupCorruptIndex(storage: FileStorage): boolean {
  try {
    const raw = storage.getItem(INDEX_KEY);
    if (raw === null) return false;
    const backupKey = `${INDEX_KEY}-corrupt`;
    if (storage.getItem(backupKey) === null) storage.setItem(backupKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function bootstrapFiles(
  storage: FileStorage,
  opts: { sample: CausalJsonDocument; now: number; newId: () => string },
): {
  files: FileMeta[];
  activeId: string;
  migrated: boolean;
  /** index：索引損毀已備份重建；legacy：舊存檔損毀已備份 */
  corrupt: "index" | "legacy" | null;
} {
  const existing = loadIndex(storage);
  if (existing.length > 0) {
    let stored: string | null = null;
    try {
      stored = storage.getItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    const activeId = existing.some((f) => f.id === stored)
      ? (stored as string)
      : sortByRecent(existing)[0].id;
    return { files: existing, activeId, migrated: false, corrupt: null };
  }

  // 索引存在卻讀不出任何檔案：重建前先備份，避免孤兒檔案永久找不回。
  const indexCorrupt = backupCorruptIndex(storage);

  // 索引為空：沿用舊單檔存檔（只讀不刪），否則用範例。
  const { doc, status } = loadStoredDocument(storage, opts.sample);
  const id = opts.newId();
  const files: FileMeta[] = [
    { id, title: doc.title ?? "", updatedAt: opts.now },
  ];
  writeFileDoc(storage, id, doc);
  writeFileLayout(storage, id, loadStoredLayout(storage));
  saveIndex(storage, files);
  try {
    storage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
  return {
    files,
    activeId: id,
    migrated: status === "loaded",
    corrupt: indexCorrupt ? "index" : status === "corrupt" ? "legacy" : null,
  };
}
