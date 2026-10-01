import { describe, expect, it } from "vitest";
import {
  DEFAULT_NODE_SIZE,
  downstreamPosition,
  nodeRect,
  rectsOverlap,
  siblingPosition,
  type Rect,
} from "./placement";

const FROM: Rect = { x: 0, y: 0, width: 160, height: 60 };

describe("placement", () => {
  it("nodeRect uses measured size or the default", () => {
    expect(nodeRect({ position: { x: 5, y: 6 } })).toEqual({
      x: 5,
      y: 6,
      ...DEFAULT_NODE_SIZE,
    });
    expect(
      nodeRect({ position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }),
    ).toEqual({ x: 0, y: 0, width: 200, height: 80 });
  });

  it("rectsOverlap ignores touching edges", () => {
    expect(rectsOverlap(FROM, { x: 160, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsOverlap(FROM, { x: 159, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it("downstream goes right in LR and down in TB", () => {
    expect(downstreamPosition(FROM, "LR", [FROM])).toEqual({ x: 240, y: 0 });
    expect(downstreamPosition(FROM, "TB", [FROM])).toEqual({ x: 0, y: 140 });
  });

  it("sibling goes below in LR and right in TB", () => {
    expect(siblingPosition(FROM, "LR", [FROM])).toEqual({ x: 0, y: 100 });
    expect(siblingPosition(FROM, "TB", [FROM])).toEqual({ x: 200, y: 0 });
  });

  it("nudges along the sibling axis until free", () => {
    const blocker: Rect = { x: 240, y: 0, width: 160, height: 60 };
    // y=0 撞、y=40 撞（40 < 60）、y=80 不撞
    expect(downstreamPosition(FROM, "LR", [FROM, blocker])).toEqual({
      x: 240,
      y: 80,
    });
    const tbBlocker: Rect = { x: 0, y: 140, width: 160, height: 60 };
    expect(downstreamPosition(FROM, "TB", [FROM, tbBlocker])).toEqual({
      x: 160,
      y: 140,
    });
  });

  it("flipped downstream goes left in LR and up in TB", () => {
    expect(downstreamPosition(FROM, "LR", [FROM], true)).toEqual({ x: -240, y: 0 });
    expect(downstreamPosition(FROM, "TB", [FROM], true)).toEqual({ x: 0, y: -140 });
  });
});
