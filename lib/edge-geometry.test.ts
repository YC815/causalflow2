import { describe, expect, it } from "vitest";
import { bendFromPoint, bendPoint, bentEdgePath, midpoint } from "./edge-geometry";

const S = { x: 0, y: 0 };
const T = { x: 200, y: 100 };

describe("edge geometry", () => {
  it("midpoint", () => {
    expect(midpoint(S, T)).toEqual({ x: 100, y: 50 });
  });
  it("bendPoint and bendFromPoint are inverses", () => {
    const b = { dx: 30, dy: -40 };
    const p = bendPoint(S, T, b);
    expect(p).toEqual({ x: 130, y: 10 });
    expect(bendFromPoint(S, T, p)).toEqual(b);
  });
  it("quadratic path passes through the control point at t=0.5", () => {
    const b = { dx: 0, dy: -60 };
    const { path, point } = bentEdgePath(S, T, b);
    expect(point).toEqual({ x: 100, y: -10 });
    // C = 2P - mid = (100, -70)
    expect(path).toBe("M 0,0 Q 100,-70 200,100");
    // B(0.5) = 0.25*S + 0.5*C + 0.25*T
    const bx = 0.25 * 0 + 0.5 * 100 + 0.25 * 200;
    const by = 0.25 * 0 + 0.5 * -70 + 0.25 * 100;
    expect({ x: bx, y: by }).toEqual(point);
  });
});
