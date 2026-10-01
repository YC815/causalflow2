import { describe, expect, it } from "vitest";
import type { CausalJsonDocument } from "@/lib/causal-json";
import {
  CORRUPT_KEY,
  DOC_KEY,
  LAYOUT_KEY,
  loadStoredDocument,
  loadStoredLayout,
  saveStoredDocument,
  saveStoredLayout,
  type StorageLike,
} from "./persistence";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

const FALLBACK: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "fallback",
  nodes: [],
  edges: [],
};

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "存檔",
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

describe("persistence", () => {
  it("round-trips a document", () => {
    const s = new MemoryStorage();
    expect(saveStoredDocument(s, DOC)).toBe(true);
    expect(loadStoredDocument(s, FALLBACK)).toEqual({
      doc: DOC,
      status: "loaded",
    });
  });

  it("returns fallback with status empty when nothing is stored", () => {
    expect(loadStoredDocument(new MemoryStorage(), FALLBACK)).toEqual({
      doc: FALLBACK,
      status: "empty",
    });
  });

  it("backs up corrupt data and returns fallback", () => {
    const s = new MemoryStorage();
    s.setItem(DOC_KEY, "{not json");
    expect(loadStoredDocument(s, FALLBACK)).toEqual({
      doc: FALLBACK,
      status: "corrupt",
    });
    expect(s.getItem(CORRUPT_KEY)).toBe("{not json");
  });

  it("never throws when storage is unavailable", () => {
    expect(loadStoredDocument(throwingStorage, FALLBACK).status).toBe("empty");
    expect(saveStoredDocument(throwingStorage, DOC)).toBe(false);
    expect(loadStoredLayout(throwingStorage)).toBe("LR");
    expect(() => saveStoredLayout(throwingStorage, "TB")).not.toThrow();
  });

  it("stores layout direction, defaulting to LR", () => {
    const s = new MemoryStorage();
    expect(loadStoredLayout(s)).toBe("LR");
    saveStoredLayout(s, "TB");
    expect(s.getItem(LAYOUT_KEY)).toBe("TB");
    expect(loadStoredLayout(s)).toBe("TB");
  });
});
