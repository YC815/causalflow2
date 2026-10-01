import { describe, expect, it } from "vitest";
import {
  fitPadding,
  isNarrowViewport,
  panelInsets,
  SIDEBAR_RIGHT_EDGE,
} from "./panel-insets";

const OPEN = { sidebarCollapsed: false, toolsCollapsed: false };
const CLOSED = { sidebarCollapsed: true, toolsCollapsed: true };

describe("panel-insets", () => {
  it("narrow breakpoint matches Tailwind sm", () => {
    expect(isNarrowViewport(390)).toBe(true);
    expect(isNarrowViewport(639)).toBe(true);
    expect(isNarrowViewport(640)).toBe(false);
  });

  it("desktop with both panels open reserves both sides", () => {
    expect(panelInsets(1440, OPEN)).toEqual({
      top: 0,
      right: 16 + 280,
      bottom: 0,
      left: SIDEBAR_RIGHT_EDGE,
    });
  });

  it("collapsed panels: capsule on top, narrow tool column on the right", () => {
    expect(panelInsets(1440, CLOSED)).toEqual({ top: 50, right: 70, bottom: 0, left: 0 });
    expect(panelInsets(390, CLOSED)).toEqual({ top: 50, right: 66, bottom: 0, left: 0 });
  });

  it("gives up side insets when panels leave too little room", () => {
    expect(panelInsets(390, OPEN)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(panelInsets(390, { sidebarCollapsed: true, toolsCollapsed: false }).right).toBe(0);
  });

  it("fitPadding without insets equals xyflow numeric padding", () => {
    // xyflow: floor((v - v / 1.2) / 2)
    expect(fitPadding(1200, 600, { top: 0, right: 0, bottom: 0, left: 0 }, 0.2)).toEqual({
      top: "50px",
      right: "100px",
      bottom: "50px",
      left: "100px",
    });
  });

  it("fitPadding adds insets and applies ratio to the visible area only", () => {
    const p = fitPadding(1440, 900, { top: 0, right: 296, bottom: 0, left: 268 }, 0.2);
    // 可見寬 876 → 每邊 73
    expect(p).toEqual({ top: "75px", right: "369px", bottom: "75px", left: "341px" });
  });
});
