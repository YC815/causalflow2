"use client";

import { Fragment, useRef } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  BaseEdge,
  EdgeProps,
  EdgeToolbar,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";
import type { CausalPolarity } from "@/lib/causal-json";
import { type Bend, type Pt, bendFromPoint, bentEdgePath } from "@/lib/edge-geometry";
import { useCausalStore } from "@/lib/store/causal-store";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";
import { chipClass, POLARITY_OPTIONS } from "./ui-classes";

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
  // 超過門檻才算拖曳：才記歷史、才改形狀，單純點擊／雙擊不產生空 commit
  const movedRef = useRef(false);
  const downRef = useRef({ x: 0, y: 0 });
  // 按下點與控制點中心的偏移（flow 座標），避免拖曳起點跳動
  const offsetRef = useRef({ x: 0, y: 0 });

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
        downRef.current = { x: e.clientX, y: e.clientY };
        const down = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        offsetRef.current = { x: point.x - down.x, y: point.y - down.y };
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (!movedRef.current) {
          const d = Math.hypot(
            e.clientX - downRef.current.x,
            e.clientY - downRef.current.y,
          );
          if (d <= 3) return;
          movedRef.current = true;
          commit();
        }
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setEdgeBend(
          id,
          bendFromPoint(source, target, {
            x: p.x + offsetRef.current.x,
            y: p.y + offsetRef.current.y,
          }),
        );
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

/** 工具列底緣與圓章中心的距離（flow 座標）：BendHandle 半徑＋線寬＋間距，不擋拖曳圓圈 */
const TOOLBAR_OFFSET = BADGE_R + 5 + 1 + 8;

/**
 * 選中單一連線（且沒選節點）時浮在圓章上方的工具列：切正負號、反轉方向。
 * EdgeToolbar 位置跟著畫布，但自身不隨縮放變小。
 */
function EdgeQuickToolbar({
  id,
  point,
  polarity,
  source,
  target,
}: {
  id: string;
  point: Pt;
  polarity: CausalPolarity;
  source: string;
  target: string;
}) {
  const solo = useCausalStore(
    (s) =>
      !s.nodes.some((n) => n.selected) &&
      s.edges.filter((e) => e.selected).length === 1,
  );
  const sourceLabel = useCausalStore(
    (s) => s.nodes.find((n) => n.id === source)?.data.label ?? "",
  );
  const targetLabel = useCausalStore(
    (s) => s.nodes.find((n) => n.id === target)?.data.label ?? "",
  );
  const updateEdge = useCausalStore((s) => s.updateEdge);
  const reverseEdge = useCausalStore((s) => s.reverseEdge);

  if (!solo) return null;
  return (
    <EdgeToolbar
      edgeId={id}
      x={point.x}
      y={point.y - TOOLBAR_OFFSET}
      alignY="bottom"
      isVisible
      role="toolbar"
      aria-label={`連線：${sourceLabel} → ${targetLabel}`}
      className="nodrag nopan flex items-center gap-1 rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper)] p-1 shadow-md"
    >
      {POLARITY_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={polarity === o.value}
          className={chipClass(polarity === o.value, o.activeClass)}
          onClick={(e) => {
            // 同值不重寫，避免留下空的復原紀錄
            if (polarity !== o.value) updateEdge(id, { polarity: o.value });
            // 釋放焦點，讓快捷鍵繼續有效
            e.currentTarget.blur();
          }}
        >
          {o.label}
        </button>
      ))}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-[var(--causal-node-border)]" />
      <button
        type="button"
        title="反轉方向"
        className={`${chipClass(false, "")} flex items-center gap-1`}
        onClick={(e) => {
          reverseEdge(id);
          e.currentTarget.blur();
        }}
      >
        <ArrowLeftRight className="size-3" aria-hidden />
        反轉方向
      </button>
    </EdgeToolbar>
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
  source: sourceId,
  target: targetId,
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
      {selected && !exporting && Number.isFinite(point.x) && Number.isFinite(point.y) && (
        <EdgeQuickToolbar
          id={id}
          point={point}
          polarity={polarity}
          source={sourceId}
          target={targetId}
        />
      )}
    </Fragment>
  );
}
