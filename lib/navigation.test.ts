import { describe, expect, it } from "vitest";
import { findNeighbor } from "./navigation";
import type { Rect } from "./placement";

const at = (x: number, y: number): Rect => ({ x, y, width: 100, height: 50 });
const ORIGIN = at(0, 0);

describe("findNeighbor", () => {
  const candidates = [
    { id: "right-near", rect: at(200, 0) },
    { id: "right-far", rect: at(500, 0) },
    { id: "left", rect: at(-300, 0) },
    { id: "down", rect: at(0, 200) },
    { id: "up", rect: at(0, -200) },
  ];

  it("picks the closest node in each direction", () => {
    expect(findNeighbor(ORIGIN, candidates, "right")).toBe("right-near");
    expect(findNeighbor(ORIGIN, candidates, "left")).toBe("left");
    expect(findNeighbor(ORIGIN, candidates, "down")).toBe("down");
    expect(findNeighbor(ORIGIN, candidates, "up")).toBe("up");
  });

  it("excludes nodes outside the 60° cone", () => {
    // 中心差 (100, 200)：與向右夾角約 63.4°，排除
    expect(findNeighbor(ORIGIN, [{ id: "steep", rect: at(100, 200) }], "right")).toBeNull();
    // 中心差 (200, 100)：夾角約 26.6°，納入
    expect(findNeighbor(ORIGIN, [{ id: "ok", rect: at(200, 100) }], "right")).toBe("ok");
  });

  it("includes exactly 60°", () => {
    // 中心差 (100, 173.205...)：cos = 0.5
    const dy = 100 * Math.tan(Math.PI / 3);
    expect(findNeighbor(ORIGIN, [{ id: "edge", rect: at(100, dy) }], "right")).toBe("edge");
  });

  it("returns null when nothing qualifies", () => {
    expect(findNeighbor(ORIGIN, [], "up")).toBeNull();
    expect(findNeighbor(ORIGIN, [{ id: "same", rect: at(0, 0) }], "up")).toBeNull();
  });
});
