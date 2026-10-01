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
  fileDocKey,
  type FileMeta,
  type FileStorage,
  loadIndex,
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
  /** 目前檔案存檔失敗時不切換，回傳 false */
  openFile(id: string): boolean;
  /** 目前檔案存檔失敗或新檔寫入失敗 → null，不留下孤兒檔案 */
  createFile(doc?: CausalJsonDocument): string | null;
  renameFile(id: string, title: string): void;
  duplicateFile(id: string): string | null;
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

const toast = (message: string) =>
  useCausalStore.getState().showToast(message);

export const useFilesStore = create<FilesState>()((set, get) => {
  /**
   * 以 storage 中的索引為準合併（其他分頁可能也改過索引），再寫回。
   * 讀不到 storage 索引時退回記憶體中的清單，避免把其他檔案洗掉。
   */
  const updateIndex = (change: (files: FileMeta[]) => FileMeta[]): boolean => {
    if (!storage) return false;
    const stored = loadIndex(storage);
    const files = change(stored.length > 0 ? stored : get().files);
    set({ files });
    return saveIndex(storage, files);
  };

  const upsertMeta = (meta: FileMeta) =>
    updateIndex((files) =>
      files.some((f) => f.id === meta.id)
        ? files.map((f) => (f.id === meta.id ? meta : f))
        : [...files, meta],
    );

  /** 切走前先存目前檔案；失敗就中止，避免遺失內容 */
  const saveBeforeLeaving = (): boolean => {
    if (get().activeId === null) return true;
    if (get().saveActive()) return true;
    toast("目前檔案存檔失敗，未切換檔案");
    return false;
  };

  /** 讀檔載入 causal store，並把載入結果記成「已存」 */
  const load = (id: string) => {
    if (!storage) return;
    const meta = get().files.find((f) => f.id === id);
    const doc = readFileDoc(storage, id);
    if (!doc) {
      // 讀不到就載入空白，但不覆寫原檔（使用者編輯前不會寫入）
      let missing = true;
      try {
        missing = storage.getItem(fileDocKey(id)) === null;
      } catch {
        /* ignore */
      }
      toast(
        missing
          ? "找不到檔案內容，已開啟空白"
          : "無法讀取檔案內容（原資料已備份）",
      );
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
    /** 目前檔案即將被丟棄（刪除最後一個檔案）時不必先存 */
    skipSave = false,
  ): string | null => {
    if (!storage || (!skipSave && !saveBeforeLeaving())) return null;
    const id = newId();
    const ok =
      writeFileDoc(storage, id, doc) &&
      upsertMeta({ id, title: doc.title ?? "", updatedAt: now() });
    if (!ok) {
      removeFile(storage, id);
      updateIndex((files) => files.filter((f) => f.id !== id));
      toast("無法建立檔案");
      return null;
    }
    writeFileLayout(storage, id, layout);
    load(id);
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
      if (id === get().activeId) return true;
      if (!get().files.some((f) => f.id === id)) return false;
      if (!saveBeforeLeaving()) return false;
      load(id);
      return true;
    },

    createFile: (doc) => addFile(doc ?? blankDocument(), "LR"),

    renameFile: (id, title) => {
      const t = title.trim();
      if (id === get().activeId) {
        // 與標題輸入框一致：可 undo
        const cs = useCausalStore.getState();
        if (cs.title !== t) {
          cs.commit();
          cs.setTitle(t);
        }
        return;
      }
      if (!storage) return;
      const doc = readFileDoc(storage, id);
      if (doc) {
        const next: CausalJsonDocument = { ...doc, title: t };
        if (!t) delete next.title;
        if (!writeFileDoc(storage, id, next)) {
          toast("重新命名失敗");
          return;
        }
      }
      const meta = get().files.find((f) => f.id === id);
      if (meta) upsertMeta({ ...meta, title: t, updatedAt: now() });
    },

    duplicateFile: (id) => {
      if (!storage) return null;
      // 先存目前檔案，複製目前檔案時才會拿到最新內容
      if (!saveBeforeLeaving()) return null;
      const meta = get().files.find((f) => f.id === id);
      const doc = readFileDoc(storage, id) ?? {
        ...blankDocument(),
        title: meta?.title || undefined,
      };
      const title = `${displayTitle(doc.title ?? "")}（副本）`;
      return addFile({ ...doc, title }, readFileLayout(storage, id));
    },

    deleteFile: (id) => {
      if (!storage) return;
      const before = get().files;
      if (!before.some((f) => f.id === id)) return;
      const wasActive = id === get().activeId;
      const isLast = before.length === 1;
      // 最後一個檔案：先建好空白檔再刪舊檔，索引絕不落成空陣列
      if (isLast && !addFile(blankDocument(), "LR", wasActive)) return;
      removeFile(storage, id);
      lastSaved.delete(id);
      const reopen = wasActive && !isLast;
      // 先放掉 activeId，避免把畫面內容存回已刪除的檔案
      if (reopen) set({ activeId: null });
      updateIndex((files) => files.filter((f) => f.id !== id));
      if (reopen) load(sortByRecent(get().files)[0].id);
    },

    saveActive: () => {
      const id = get().activeId;
      // 未初始化時絕不吞掉存檔：回報失敗讓呼叫端提示
      if (!storage || !id) return false;
      const { doc, layout } = currentDocument();
      const key = serialize(doc, layout);
      if (lastSaved.get(id) === key) return true;
      if (!writeFileDoc(storage, id, doc)) return false;
      lastSaved.set(id, key);
      writeFileLayout(storage, id, layout);
      return upsertMeta({ id, title: doc.title ?? "", updatedAt: now() });
    },
  };
});
