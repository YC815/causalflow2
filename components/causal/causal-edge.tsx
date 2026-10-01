"use client";

import { Fragment, useRef } from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import type { CausalPolarity } from "@/lib/causal-json";
import { type Bend, type Pt, bendFromPoint, bentEdgePath } from "@/lib/edge-geometry";
import { useCausalStore } from "@/lib/store/causal-store";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";

export type CausalEdgeData = {
  polarity: CausalPolarity;
  bend?: Bend;
};

function strokeForPolarity(polarity: CausalPolarity): string {
  return CAUSAL_EDGE_STROKE_HEX[polarity];
}

function normalizePolarity(
  data: { polarity?: unknown } | undefined | null,
): CausalPolarity {
  const p = data?.polarity;
  if (p === "negative" || p === "neutral") return p;
  return "positive";
}

const BADGE_R = 17;
/** 圓框線寬 */
const BADGE_RING_SW = 3;
/** 正／負號筆畫寬度 */
const BADGE_SYMBOL_SW = 3.75;

function EdgePolarBadge({
  cx,
  cy,
  polarity,
  stroke,
}: {
  cx: number;
  cy: number;
  polarity: "positive" | "negative";
  stroke: string;
}) {
  const arm = 10;
  return (
    <g
      transform={`translate(${cx} ${cy})`}
      className="react-flow__edge-text"
    >
      <circle
        r={BADGE_R}
        fill="var(--causal-paper)"
        stroke={stroke}
        strokeWidth={BADGE_RING_SW}
      />
      {polarity === "positive" ? (
        <g
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth={BADGE_SYMBOL_SW}
        >
          <line x1={0} y1={-arm} x2={0} y2={arm} />
          <line x1={-arm} y1={0} x2={arm} y2={0} />
        </g>
      ) : (
        <line
          x1={-arm - 1}
          y1={0}
          x2={arm + 1}
          y2={0}
          stroke={stroke}
          strokeWidth={BADGE_SYMBOL_SW}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

function BendHandle({
  id,
  point,
  source,
  target,
}: {
  id: string;
  point: Pt;
  source: Pt;
  target: Pt;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const commit = useCausalStore((s) => s.commit);
  const setEdgeBend = useCausalStore((s) => s.setEdgeBend);
  const resetEdgeBend = useCausalStore((s) => s.resetEdgeBend);
  // 只在第一次移動時記歷史，單純點擊不產生空 commit
  const movedRef = useRef(false);

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={BADGE_R + 5}
      className="nodrag nopan"
      fill="transparent"
      stroke="var(--causal-accent)"
      strokeWidth={2}
      strokeDasharray="4 3"
      style={{ cursor: "move", pointerEvents: "all" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        movedRef.current = false;
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (!movedRef.current) {
          movedRef.current = true;
          commit();
        }
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setEdgeBend(id, bendFromPoint(source, target, p));
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        resetEdgeBend(id);
      }}
    />
  );
}

export function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const polarity = normalizePolarity(data);
  const exporting = useCausalStore((s) => s.exporting);
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const bend = data?.bend as Bend | undefined;
  let edgePath: string;
  let point: Pt;
  if (bend) {
    ({ path: edgePath, point } = bentEdgePath(source, target, bend));
  } else {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = path;
    point = { x: labelX, y: labelY };
  }

  const stroke = strokeForPolarity(polarity);
  const dash = polarity === "negative" ? "7 5" : undefined;
  const showBadge =
    polarity === "positive" || polarity === "negative"
      ? polarity
      : null;

  return (
    <Fragment>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: selected ? 2.75 : 2,
          strokeDasharray: dash,
        }}
      />
      {showBadge && Number.isFinite(point.x) && Number.isFinite(point.y) && (
        <EdgePolarBadge
          cx={point.x}
          cy={point.y}
          polarity={showBadge}
          stroke={stroke}
        />
      )}
      {selected && !exporting && (
        <BendHandle id={id} point={point} source={source} target={target} />
      )}
    </Fragment>
  );
}
