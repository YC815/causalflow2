import { beforeEach, describe, expect, it } from "vitest";
import type { CausalJsonDocument } from "@/lib/causal-json";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import { useCausalStore } from "./causal-store";
import {
  ACTIVE_KEY,
  fileDocKey,
  INDEX_KEY,
  loadIndex,
  saveIndex,
  fileLayoutKey,
  type FileStorage,
  readFileDoc,
  readFileLayout,
  writeFileDoc,
} from "./files";
import { useFilesStore } from "./files-store";
import { DOC_KEY, LAYOUT_KEY } from "./persistence";

class MemoryStorage implements FileStorage {
  data = new Map<string, string>();
  writes = 0;
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("quota");
    this.writes += 1;
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "匯入",
  nodes: [
    { id: "a", label: "A", x: 1, y: 2 },
    { id: "b", label: "B", x: 3, y: 4 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", direction: "one-way", polarity: "negative" },
  ],
};

const c = () => useCausalStore.getState();
const f = () => useFilesStore.getState();
const meta = (id: string) => f().files.find((m) => m.id === id)!;

let storage: MemoryStorage;
let clock: number;
let idSeq: number;

function init() {
  f().init(storage, {
    now: () => ++clock,
    newId: () => `id${++idSeq}`,
  });
}

beforeEach(() => {
  useCausalStore.setState(useCausalStore.getInitialState(), true);
  useFilesStore.setState(useFilesStore.getInitialState(), true);
  storage = new MemoryStorage();
  clock = 1000;
  idSeq = 0;
});

describe("files store", () => {
  it("init on empty storage creates one file with the sample", () => {
    init();
    expect(f().files).toHaveLength(1);
    expect(f().activeId).toBe(f().files[0].id);
    expect(c().title).toBe(SAMPLE_CAUSAL_DOCUMENT.title);
    expect(c().nodes).toHaveLength(SAMPLE_CAUSAL_DOCUMENT.nodes.length);
    expect(c().history.past).toHaveLength(0);
  });

  it("init migrates the legacy single document and autosaves to the file", () => {
    const legacy = JSON.stringify(DOC);
    storage.setItem(DOC_KEY, legacy);
    storage.setItem(LAYOUT_KEY, "TB");
    expect(f().init(storage).corrupt).toBeNull();
    const a = f().activeId!;
    expect(c().title).toBe("匯入");
    expect(c().nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(c().layoutDirection).toBe("TB");
    c().addNode({ x: 0, y: 0 });
    expect(f().saveActive()).toBe(true);
    expect(readFileDoc(storage, a)?.nodes).toHaveLength(3);
    expect(storage.getItem(DOC_KEY)).toBe(legacy);
  });

  it("init restores the stored active file", () => {
    init();
    const first = f().activeId!;
    const second = f().createFile(DOC)!;
    useCausalStore.setState(useCausalStore.getInitialState(), true);
    useFilesStore.setState(useFilesStore.getInitialState(), true);
    init();
    expect(f().files).toHaveLength(2);
    expect(f().activeId).toBe(second);
    expect(c().title).toBe("匯入");
    expect(first).not.toBe(second);
  });

  it("createFile opens a blank file with empty history", () => {
    init();
    c().addNode({ x: 0, y: 0 });
    const id = f().createFile()!;
    expect(f().files).toHaveLength(2);
    expect(f().activeId).toBe(id);
    expect(c().nodes).toHaveLength(0);
    expect(c().title).toBe("");
    expect(c().history.past).toHaveLength(0);
    expect(c().history.future).toHaveLength(0);
    expect(storage.getItem(ACTIVE_KEY)).toBe(id);
  });

  it("createFile(doc) opens the given document", () => {
    init();
    const id = f().createFile(DOC)!;
    expect(f().activeId).toBe(id);
    expect(c().nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(meta(id).title).toBe("匯入");
    expect(readFileDoc(storage, id)).toEqual(DOC);
  });

  it("switching keeps edits and only bumps updatedAt of the edited file", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile()!;
    f().openFile(a);
    const aBefore = meta(a).updatedAt;
    const bBefore = meta(b).updatedAt;
    const nodeId = c().addNode({ x: 5, y: 5 });
    f().openFile(b);
    expect(c().nodes).toHaveLength(0);
    f().openFile(a);
    expect(c().nodes.some((n) => n.id === nodeId)).toBe(true);
    expect(meta(a).updatedAt).toBeGreaterThan(aBefore);
    expect(meta(b).updatedAt).toBe(bBefore);
  });

  it("openFile clears undo history", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile()!;
    c().addNode({ x: 0, y: 0 });
    expect(c().history.past.length).toBeGreaterThan(0);
    f().openFile(a);
    expect(c().history.past).toHaveLength(0);
    f().openFile(b);
    expect(c().history.past).toHaveLength(0);
  });

  it("openFile preserves each file's layout direction", () => {
    init();
    const a = f().activeId!;
    c().applyLayout("TB");
    const b = f().createFile()!;
    expect(c().layoutDirection).toBe("LR");
    expect(readFileLayout(storage, a)).toBe("TB");
    f().openFile(a);
    expect(c().layoutDirection).toBe("TB");
    f().openFile(b);
    expect(c().layoutDirection).toBe("LR");
  });

  it("renameFile on the active file sets causal title; saveActive syncs index", () => {
    init();
    const a = f().activeId!;
    f().renameFile(a, "新名字");
    expect(c().title).toBe("新名字");
    expect(f().saveActive()).toBe(true);
    expect(meta(a).title).toBe("新名字");
    expect(readFileDoc(storage, a)?.title).toBe("新名字");
  });

  it("renameFile on a non-active file rewrites its doc and index only", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile(DOC)!;
    const before = meta(a).updatedAt;
    f().renameFile(a, "別的");
    expect(meta(a).title).toBe("別的");
    expect(meta(a).updatedAt).toBeGreaterThan(before);
    expect(readFileDoc(storage, a)?.title).toBe("別的");
    expect(f().activeId).toBe(b);
    expect(c().title).toBe("匯入");
  });

  it("duplicateFile copies content and layout and opens the copy", () => {
    init();
    const a = f().createFile(DOC)!;
    c().applyLayout("TB");
    const nodesBefore = c().nodes.map((n) => ({ id: n.id, position: n.position }));
    const copy = f().duplicateFile(a)!;
    expect(copy).not.toBe(a);
    expect(f().activeId).toBe(copy);
    expect(meta(copy).title).toContain("（副本）");
    expect(c().title).toContain("（副本）");
    expect(c().nodes.map((n) => ({ id: n.id, position: n.position }))).toEqual(
      nodesBefore,
    );
    expect(c().layoutDirection).toBe("TB");
    expect(readFileLayout(storage, copy)).toBe("TB");
  });

  it("deleteFile on active opens the most recent remaining file", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile(DOC)!;
    const d = f().createFile()!;
    // 讓 b 比 a 新
    f().openFile(b);
    c().addNode({ x: 0, y: 0 });
    f().openFile(d);
    f().deleteFile(d);
    expect(f().files.map((m) => m.id).sort()).toEqual([a, b].sort());
    expect(f().activeId).toBe(b);
    expect(storage.getItem(fileDocKey(d))).toBeNull();
    expect(storage.getItem(fileLayoutKey(d))).toBeNull();
    expect(storage.getItem(ACTIVE_KEY)).toBe(b);
  });

  it("deleteFile of a non-active file keeps the active file", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile(DOC)!;
    f().deleteFile(a);
    expect(f().files.map((m) => m.id)).toEqual([b]);
    expect(f().activeId).toBe(b);
    expect(storage.getItem(fileDocKey(a))).toBeNull();
  });

  it("deleting the last file creates a blank one", () => {
    init();
    const a = f().activeId!;
    f().deleteFile(a);
    expect(f().files).toHaveLength(1);
    expect(f().activeId).not.toBe(a);
    expect(c().nodes).toHaveLength(0);
    expect(storage.getItem(fileDocKey(a))).toBeNull();
  });

  it("saveActive skips writing when content is unchanged", () => {
    init();
    const a = f().activeId!;
    const before = meta(a).updatedAt;
    const writes = storage.writes;
    expect(f().saveActive()).toBe(true);
    expect(storage.writes).toBe(writes);
    expect(meta(a).updatedAt).toBe(before);
    // 選取不算內容變更
    c().selectAll();
    f().saveActive();
    expect(storage.writes).toBe(writes);
    c().addNode({ x: 0, y: 0 });
    f().saveActive();
    expect(storage.writes).toBeGreaterThan(writes);
    expect(meta(a).updatedAt).toBeGreaterThan(before);
  });

  it("an unreadable active file loads blank without overwriting it", () => {
    init();
    const a = f().activeId!;
    storage.setItem(fileDocKey(a), "{bad");
    useFilesStore.setState(useFilesStore.getInitialState(), true);
    init();
    expect(f().activeId).toBe(a);
    expect(c().nodes).toHaveLength(0);
    f().saveActive();
    expect(storage.getItem(fileDocKey(a))).toBe("{bad");
    expect(storage.getItem(`${fileDocKey(a)}-corrupt`)).toBe("{bad");
  });

  it("does not treat writeFileDoc helper output as stale after reload", () => {
    init();
    const a = f().activeId!;
    writeFileDoc(storage, a, DOC);
    useFilesStore.setState(useFilesStore.getInitialState(), true);
    init();
    const before = meta(a).updatedAt;
    f().saveActive();
    expect(meta(a).updatedAt).toBe(before);
  });

  it("uninitialized saveActive reports failure", () => {
    expect(f().saveActive()).toBe(false);
  });

  it("saveActive failure leaves index, layout and updatedAt untouched", () => {
    init();
    const a = f().activeId!;
    const before = meta(a).updatedAt;
    const index = storage.getItem(INDEX_KEY);
    c().applyLayout("TB");
    storage.failWrites = true;
    expect(f().saveActive()).toBe(false);
    storage.failWrites = false;
    expect(meta(a).updatedAt).toBe(before);
    expect(storage.getItem(INDEX_KEY)).toBe(index);
    expect(readFileLayout(storage, a)).toBe("LR");
    // 之後恢復可寫時會重試
    expect(f().saveActive()).toBe(true);
    expect(readFileLayout(storage, a)).toBe("TB");
  });

  it("openFile does not switch when saving the current file fails", () => {
    init();
    const a = f().activeId!;
    const b = f().createFile(DOC)!;
    f().openFile(a);
    const nodeId = c().addNode({ x: 0, y: 0 });
    storage.failWrites = true;
    expect(f().openFile(b)).toBe(false);
    expect(f().activeId).toBe(a);
    expect(c().nodes.some((n) => n.id === nodeId)).toBe(true);
    expect(c().history.past.length).toBeGreaterThan(0);
    expect(c().toast).toBe("目前檔案存檔失敗，未切換檔案");
  });

  it("createFile aborts without an orphan when saving the current file fails", () => {
    init();
    const a = f().activeId!;
    const nodeId = c().addNode({ x: 0, y: 0 });
    const keys = [...storage.data.keys()].sort();
    storage.failWrites = true;
    expect(f().createFile(DOC)).toBeNull();
    expect(f().activeId).toBe(a);
    expect(f().files).toHaveLength(1);
    expect(c().nodes.some((n) => n.id === nodeId)).toBe(true);
    expect([...storage.data.keys()].sort()).toEqual(keys);
    expect(loadIndex(storage)).toHaveLength(1);
  });

  it("duplicateFile aborts without an orphan when saving fails", () => {
    init();
    const a = f().activeId!;
    c().addNode({ x: 0, y: 0 });
    const keys = [...storage.data.keys()].sort();
    storage.failWrites = true;
    expect(f().duplicateFile(a)).toBeNull();
    expect(f().activeId).toBe(a);
    expect(f().files).toHaveLength(1);
    expect([...storage.data.keys()].sort()).toEqual(keys);
  });

  it("index writes merge entries added by another tab", () => {
    init();
    const a = f().activeId!;
    const other = { id: "other-tab", title: "別分頁", updatedAt: 1 };
    saveIndex(storage, [...loadIndex(storage), other]);
    c().addNode({ x: 0, y: 0 });
    expect(f().saveActive()).toBe(true);
    expect(loadIndex(storage)).toContainEqual(other);
    expect(f().files).toContainEqual(other);
    expect(loadIndex(storage).some((m) => m.id === a)).toBe(true);
    const b = f().createFile()!;
    expect(loadIndex(storage).map((m) => m.id).sort()).toEqual(
      [a, b, "other-tab"].sort(),
    );
    f().deleteFile(a);
    expect(loadIndex(storage).map((m) => m.id).sort()).toEqual(
      [b, "other-tab"].sort(),
    );
  });

  it("distinguishes a missing doc from a corrupt one", () => {
    init();
    const a = f().activeId!;
    storage.removeItem(fileDocKey(a));
    useFilesStore.setState(useFilesStore.getInitialState(), true);
    init();
    expect(c().toast).toBe("找不到檔案內容，已開啟空白");
    storage.setItem(fileDocKey(a), "{bad");
    useFilesStore.setState(useFilesStore.getInitialState(), true);
    init();
    expect(c().toast).toBe("無法讀取檔案內容（原資料已備份）");
  });
});
