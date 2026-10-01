import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  discardLast,
  emptyHistory,
  record,
  redo,
  undo,
} from "./history";

describe("history", () => {
  it("undo returns the last recorded snapshot and moves current to future", () => {
    const h = record(emptyHistory<number>(), 1);
    const r = undo(h, 2);
    expect(r).not.toBeNull();
    expect(r!.state).toBe(1);
    expect(r!.history).toEqual({ past: [], future: [2] });
  });

  it("redo reverses undo", () => {
    const afterUndo = undo(record(emptyHistory<number>(), 1), 2)!;
    const r = redo(afterUndo.history, afterUndo.state);
    expect(r!.state).toBe(2);
    expect(r!.history).toEqual({ past: [1], future: [] });
  });

  it("returns null when nothing to undo or redo", () => {
    expect(undo(emptyHistory<number>(), 0)).toBeNull();
    expect(redo(emptyHistory<number>(), 0)).toBeNull();
  });

  it("record clears future", () => {
    const afterUndo = undo(record(emptyHistory<number>(), 1), 2)!;
    const h = record(afterUndo.history, 1);
    expect(h.future).toEqual([]);
  });

  it("caps past at HISTORY_LIMIT, dropping the oldest", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
  });

  it("discardLast drops only the newest past entry", () => {
    const h = record(record(emptyHistory<number>(), 1), 2);
    expect(discardLast(h)).toEqual({ past: [1], future: [] });
    expect(discardLast(emptyHistory<number>())).toEqual({ past: [], future: [] });
  });
});
