"use client";

import { BaseEdge, EdgeProps, getBezierPath } from "@xyflow/react";

export type CausalEdgeData = {
  bidirectional: boolean;
  polarity: "positive" | "negative";
};

function strokeForPolarity(polarity: CausalEdgeData["polarity"]): string {
  return polarity === "negative"
    ? "var(--causal-edge-neg)"
    : "var(--causal-edge-pos)";
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
  const polarity: CausalEdgeData["polarity"] =
    data?.polarity === "negative" ? "negative" : "positive";
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
  const sign = polarity === "negative" ? "-" : "+";

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      labelX={labelX}
      labelY={labelY}
      label={sign}
      labelShowBg
      labelStyle={{
        fill: stroke,
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "var(--font-causal-serif), 'Noto Serif TC', serif",
      }}
      labelBgStyle={{
        fill: "var(--causal-paper)",
        fillOpacity: 0.94,
      }}
      labelBgPadding={[5, 7] as [number, number]}
      labelBgBorderRadius={5}
      markerEnd={markerEnd}
      markerStart={bidirectional ? markerStart : undefined}
      style={{
        stroke,
        strokeWidth: selected ? 2.75 : 2,
        strokeDasharray: dash,
      }}
    />
  );
}
