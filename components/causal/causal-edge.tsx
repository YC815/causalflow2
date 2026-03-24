"use client";

import { Fragment } from "react";
import { BaseEdge, EdgeProps, getBezierPath } from "@xyflow/react";
import type { CausalPolarity } from "@/lib/causal-json";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";

export type CausalEdgeData = {
  bidirectional: boolean;
  polarity: CausalPolarity;
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

export function CausalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  data,
  selected,
}: EdgeProps) {
  const polarity = normalizePolarity(data);
  const bidirectional = Boolean(data?.bidirectional);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

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
        markerStart={bidirectional ? markerStart : undefined}
        style={{
          stroke,
          strokeWidth: selected ? 2.75 : 2,
          strokeDasharray: dash,
        }}
      />
      {showBadge &&
        Number.isFinite(labelX) &&
        Number.isFinite(labelY) && (
          <EdgePolarBadge
            cx={labelX}
            cy={labelY}
            polarity={showBadge}
            stroke={stroke}
          />
        )}
    </Fragment>
  );
}
