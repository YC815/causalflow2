import { describe, expect, it } from "vitest";
import type { CausalJsonDocument } from "@/lib/causal-json";
import {
  ACTIVE_KEY,
  bootstrapFiles,
  displayTitle,
  fileDocKey,
  fileLayoutKey,
  type FileStorage,
  INDEX_KEY,
  loadIndex,
  readFileDoc,
  readFileLayout,
  removeFile,
  saveIndex,
  sortByRecent,
  UNTITLED,
  writeFileDoc,
  writeFileLayout,
} from "./files";
import { DOC_KEY, LAYOUT_KEY } from "./persistence";

class MemoryStorage implements FileStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const throwingStorage: FileStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const SAMPLE: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "範例",
  nodes: [{ id: "s", label: "S", x: 0, y: 0 }],
  edges: [],
};

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "舊存檔",
  nodes: [
    { id: "a", label: "A", x: 1, y: 2 },
    { id: "b", label: "B", x: 3, y: 4 },
  ],
  edges: [
    {
      id: "ab",
      source: "a",
      target: "b",
      direction: "one-way",
      polarity: "negative",
    },
  ],
};

const opts = { sample: SAMPLE, now: 1000, newId: () => "new1" };

describe("displayTitle / sortByRecent", () => {
  it("falls back to UNTITLED for blank titles", () => {
    expect(displayTitle("  ")).toBe(UNTITLED);
    expect(displayTitle("")).toBe(UNTITLED);
    expect(displayTitle("A")).toBe("A");
  });

  it("sorts by updatedAt desc without mutating input", () => {
    const input = [
      { id: "1", title: "a", updatedAt: 1 },
      { id: "2", title: "b", updatedAt: 3 },
      { id: "3", title: "c", updatedAt: 2 },
    ];
    expect(sortByRecent(input).map((f) => f.id)).toEqual(["2", "3", "1"]);
    expect(input.map((f) => f.id)).toEqual(["1", "2", "3"]);
  });
});

describe("index", () => {
  it("returns [] when missing or corrupt", () => {
    const s = new MemoryStorage();
    expect(loadIndex(s)).toEqual([]);
    s.setItem(INDEX_KEY, "{bad");
    expect(loadIndex(s)).toEqual([]);
    s.setItem(INDEX_KEY, '{"a":1}');
    expect(loadIndex(s)).toEqual([]);
  });

  it("filters invalid entries", () => {
    const s = new MemoryStorage();
    s.setItem(
      INDEX_KEY,
      JSON.stringify([
        { id: "ok", title: "t", updatedAt: 1 },
        { title: "no id", updatedAt: 1 },
        { id: "x", title: "t", updatedAt: "1" },
        { id: "y", title: 5, updatedAt: 1 },
        null,
      ]),
    );
    expect(loadIndex(s)).toEqual([{ id: "ok", title: "t", updatedAt: 1 }]);
  });

  it("round-trips", () => {
    const s = new MemoryStorage();
    const files = [{ id: "1", title: "a", updatedAt: 1 }];
    expect(saveIndex(s, files)).toBe(true);
    expect(loadIndex(s)).toEqual(files);
  });
});

describe("file doc / layout", () => {
  it("round-trips a doc", () => {
    const s = new MemoryStorage();
    expect(readFileDoc(s, "f")).toBeNull();
    expect(writeFileDoc(s, "f", DOC)).toBe(true);
    expect(readFileDoc(s, "f")).toEqual(DOC);
  });

  it("returns null and backs up corrupt content", () => {
    const s = new MemoryStorage();
    s.setItem(fileDocKey("f"), "{bad");
    expect(readFileDoc(s, "f")).toBeNull();
    expect(s.getItem(`${fileDocKey("f")}-corrupt`)).toBe("{bad");
  });

  it("layout defaults to LR and can store TB", () => {
    const s = new MemoryStorage();
    expect(readFileLayout(s, "f")).toBe("LR");
    writeFileLayout(s, "f", "TB");
    expect(readFileLayout(s, "f")).toBe("TB");
    expect(readFileLayout(s, "other")).toBe("LR");
  });

  it("removeFile removes doc and layout keys", () => {
    const s = new MemoryStorage();
    writeFileDoc(s, "f", DOC);
    writeFileLayout(s, "f", "TB");
    removeFile(s, "f");
    expect(s.getItem(fileDocKey("f"))).toBeNull();
    expect(s.getItem(fileLayoutKey("f"))).toBeNull();
  });
});

describe("bootstrapFiles", () => {
  it("creates one file from sample on empty storage", () => {
    const s = new MemoryStorage();
    const r = bootstrapFiles(s, opts);
    expect(r).toEqual({
      files: [{ id: "new1", title: "範例", updatedAt: 1000 }],
      activeId: "new1",
      migrated: false,
    });
    expect(s.getItem(ACTIVE_KEY)).toBe("new1");
    expect(loadIndex(s)).toEqual(r.files);
    expect(readFileDoc(s, "new1")).toEqual(SAMPLE);
    expect(readFileLayout(s, "new1")).toBe("LR");
  });

  it("migrates legacy doc and layout, keeping legacy keys", () => {
    const s = new MemoryStorage();
    s.setItem(DOC_KEY, JSON.stringify(DOC));
    s.setItem(LAYOUT_KEY, "TB");
    const r = bootstrapFiles(s, opts);
    expect(r.migrated).toBe(true);
    expect(r.files[0]).toEqual({ id: "new1", title: "舊存檔", updatedAt: 1000 });
    expect(readFileDoc(s, "new1")).toEqual(DOC);
    expect(readFileLayout(s, "new1")).toBe("TB");
    expect(s.getItem(DOC_KEY)).not.toBeNull();
    expect(s.getItem(LAYOUT_KEY)).toBe("TB");
  });

  it("does not create anything when index exists; prefers ACTIVE_KEY", () => {
    const s = new MemoryStorage();
    const files = [
      { id: "old", title: "o", updatedAt: 1 },
      { id: "recent", title: "r", updatedAt: 9 },
    ];
    saveIndex(s, files);
    s.setItem(ACTIVE_KEY, "old");
    const r = bootstrapFiles(s, opts);
    expect(r).toEqual({ files, activeId: "old", migrated: false });
    expect(s.data.has(fileDocKey("new1"))).toBe(false);
    expect(loadIndex(s)).toEqual(files);
  });

  it("falls back to most recent when ACTIVE_KEY is stale", () => {
    const s = new MemoryStorage();
    saveIndex(s, [
      { id: "old", title: "o", updatedAt: 1 },
      { id: "recent", title: "r", updatedAt: 9 },
    ]);
    s.setItem(ACTIVE_KEY, "gone");
    expect(bootstrapFiles(s, opts).activeId).toBe("recent");
  });
});

describe("throwing storage", () => {
  it("never throws", () => {
    const s = throwingStorage;
    expect(loadIndex(s)).toEqual([]);
    expect(saveIndex(s, [])).toBe(false);
    expect(readFileDoc(s, "f")).toBeNull();
    expect(writeFileDoc(s, "f", DOC)).toBe(false);
    expect(readFileLayout(s, "f")).toBe("LR");
    expect(() => writeFileLayout(s, "f", "TB")).not.toThrow();
    expect(() => removeFile(s, "f")).not.toThrow();
    const r = bootstrapFiles(s, opts);
    expect(r.files).toHaveLength(1);
    expect(r.activeId).toBe("new1");
  });
});
