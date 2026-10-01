import { create } from "zustand";
import { flowToDocument } from "@/components/causal/flow-adapters";
import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";
import { type CausalJsonDocument, stringifyCausalJson } from "@/lib/causal-json";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import { uid, useCausalStore } from "./causal-store";
import {
  ACTIVE_KEY,
  bootstrapFiles,
  displayTitle,
  type FileMeta,
  type FileStorage,
  readFileDoc,
  readFileLayout,
  removeFile,
  saveIndex,
  sortByRecent,
  writeFileDoc,
  writeFileLayout,
} from "./files";

export type FilesState = {
  /** 未排序；UI 自行 sortByRecent */
  files: FileMeta[];
  activeId: string | null;
  init(
    storage: FileStorage,
    opts?: { now?: () => number; newId?: () => string },
  ): { corrupt: "index" | "legacy" | null };
  openFile(id: string): void;
  createFile(doc?: CausalJsonDocument): string;
  renameFile(id: string, title: string): void;
  duplicateFile(id: string): string;
  deleteFile(id: string): void;
  /** 回傳 false 表示寫入失敗 */
  saveActive(): boolean;
};

const blankDocument = (): CausalJsonDocument => ({
  causalflowVersion: 1,
  nodes: [],
  edges: [],
});

let storage: FileStorage | null = null;
let now: () => number = Date.now;
let newId: () => string = () => `f-${uid()}`;
/** 每個檔案上次寫入（或載入）時的序列化內容；相同就不寫，開檔不會改到 updatedAt */
const lastSaved = new Map<string, string>();

function currentDocument(): {
  doc: CausalJsonDocument;
  layout: CausalLayoutDirection;
} {
  const { nodes, edges, title, layoutDirection } = useCausalStore.getState();
  return {
    doc: flowToDocument(nodes, edges, title.trim() || undefined),
    layout: layoutDirection,
  };
}

function serialize(doc: CausalJsonDocument, layout: CausalLayoutDirection) {
  return `${layout}\n${stringifyCausalJson(doc)}`;
}

export const useFilesStore = create<FilesState>()((set, get) => {
  /** 讀檔載入 causal store，並把載入結果記成「已存」 */
  const load = (id: string) => {
    if (!storage) return;
    const meta = get().files.find((f) => f.id === id);
    const doc = readFileDoc(storage, id);
    if (!doc) {
      // 讀不到就載入空白，但不覆寫原檔（使用者編輯前不會寫入）
      useCausalStore.getState().showToast("無法讀取檔案內容（原資料已備份）");
    }
    useCausalStore
      .getState()
      .loadDocument(
        doc ?? { ...blankDocument(), title: meta?.title || undefined },
        readFileLayout(storage, id),
      );
    const cur = currentDocument();
    lastSaved.set(id, serialize(cur.doc, cur.layout));
    try {
      storage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
    set({ activeId: id });
  };

  const addFile = (
    doc: CausalJsonDocument,
    layout: CausalLayoutDirection,
  ): string => {
    const id = newId();
    if (storage) {
      writeFileDoc(storage, id, doc);
      writeFileLayout(storage, id, layout);
    }
    const files = [
      ...get().files,
      { id, title: doc.title ?? "", updatedAt: now() },
    ];
    set({ files });
    if (storage) saveIndex(storage, files);
    get().openFile(id);
    return id;
  };

  return {
    files: [],
    activeId: null,

    init: (s, opts) => {
      storage = s;
      now = opts?.now ?? Date.now;
      newId = opts?.newId ?? (() => `f-${uid()}`);
      lastSaved.clear();
      const r = bootstrapFiles(s, {
        sample: SAMPLE_CAUSAL_DOCUMENT,
        now: now(),
        newId,
      });
      set({ files: r.files, activeId: null });
      load(r.activeId);
      return { corrupt: r.corrupt };
    },

    openFile: (id) => {
      if (id === get().activeId) return;
      if (!get().files.some((f) => f.id === id)) return;
      get().saveActive();
      load(id);
    },

    createFile: (doc) => addFile(doc ?? blankDocument(), "LR"),

    renameFile: (id, title) => {
      if (id === get().activeId) {
        useCausalStore.getState().setTitle(title);
        return;
      }
      const t = title.trim();
      if (storage) {
        const doc = readFileDoc(storage, id);
        if (doc) {
          const next: CausalJsonDocument = { ...doc, title: t };
          if (!t) delete next.title;
          writeFileDoc(storage, id, next);
        }
      }
      const files = get().files.map((f) =>
        f.id === id ? { ...f, title: t, updatedAt: now() } : f,
      );
      set({ files });
      if (storage) saveIndex(storage, files);
    },

    duplicateFile: (id) => {
      if (id === get().activeId) get().saveActive();
      const meta = get().files.find((f) => f.id === id);
      const doc = (storage && readFileDoc(storage, id)) ?? {
        ...blankDocument(),
        title: meta?.title || undefined,
      };
      const layout = storage ? readFileLayout(storage, id) : "LR";
      const title = `${displayTitle(doc.title ?? "")}（副本）`;
      return addFile({ ...doc, title }, layout);
    },

    deleteFile: (id) => {
      if (!get().files.some((f) => f.id === id)) return;
      if (storage) removeFile(storage, id);
      lastSaved.delete(id);
      const files = get().files.filter((f) => f.id !== id);
      const wasActive = id === get().activeId;
      // 先放掉 activeId，避免 openFile 把畫面內容存回已刪除的檔案
      set({ files, activeId: wasActive ? null : get().activeId });
      if (files.length === 0) {
        get().createFile();
        return;
      }
      if (storage) saveIndex(storage, files);
      if (wasActive) get().openFile(sortByRecent(files)[0].id);
    },

    saveActive: () => {
      const id = get().activeId;
      if (!storage || !id) return true;
      const { doc, layout } = currentDocument();
      const key = serialize(doc, layout);
      if (lastSaved.get(id) === key) return true;
      const ok = writeFileDoc(storage, id, doc);
      writeFileLayout(storage, id, layout);
      const files = get().files.map((f) =>
        f.id === id ? { ...f, title: doc.title ?? "", updatedAt: now() } : f,
      );
      set({ files });
      const indexOk = saveIndex(storage, files);
      if (ok) lastSaved.set(id, key);
      return ok && indexOk;
    },
  };
});
