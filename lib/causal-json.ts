/**
 * CausalFlow JSON — 與畫布雙向轉換的單一格式。
 * 給人與給 AI 匯入時請遵守同一結構。
 */

export const CAUSAL_JSON_VERSION = 1 as const;

/** 連線接在節點的輸入側或輸出側 */
export type HandleSide = "in" | "out";

export type CausalDirection = "one-way";
/** 正／負相關，或「未指定」（僅表示有連結、尚未標正負） */
export type CausalPolarity = "positive" | "negative" | "neutral";

export type CausalJsonNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  flipped?: true;
};

export type CausalJsonEdge = {
  id: string;
  source: string;
  target: string;
  direction: CausalDirection;
  polarity: CausalPolarity;
  bend?: { dx: number; dy: number };
  /** 只保留非預設值（預設 source 用 out、target 用 in） */
  sourceSide?: "in";
  targetSide?: "out";
};

export type CausalJsonDocument = {
  causalflowVersion: typeof CAUSAL_JSON_VERSION;
  title?: string;
  nodes: CausalJsonNode[];
  edges: CausalJsonEdge[];
};

export class CausalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CausalJsonError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new CausalJsonError(`欄位 "${field}" 必須為非空字串`);
  }
  return v;
}

function asNumber(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new CausalJsonError(`欄位 "${field}" 必須為有限數字`);
  }
  return v;
}

export function parseCausalJson(raw: string): CausalJsonDocument {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new CausalJsonError("不是有效的 JSON");
  }
  if (!isRecord(data)) {
    throw new CausalJsonError("根物件必須是 JSON 物件");
  }
  if (data.causalflowVersion !== CAUSAL_JSON_VERSION) {
    throw new CausalJsonError(
      `causalflowVersion 必須為 ${CAUSAL_JSON_VERSION}`,
    );
  }
  if (!Array.isArray(data.nodes)) {
    throw new CausalJsonError("nodes 必須為陣列");
  }
  if (!Array.isArray(data.edges)) {
    throw new CausalJsonError("edges 必須為陣列");
  }

  const nodes: CausalJsonNode[] = data.nodes.map((n, i) => {
    if (!isRecord(n)) {
      throw new CausalJsonError(`nodes[${i}] 必須為物件`);
    }
    if (n.flipped !== undefined && typeof n.flipped !== "boolean") {
      throw new CausalJsonError(
        `nodes[${i}].flipped 若提供必須為 true 或 false`,
      );
    }
    const flipped = n.flipped === true;
    return {
      id: asString(n.id, `nodes[${i}].id`),
      label: asString(n.label, `nodes[${i}].label`),
      x: asNumber(n.x, `nodes[${i}].x`),
      y: asNumber(n.y, `nodes[${i}].y`),
      ...(flipped ? { flipped: true as const } : {}),
    };
  });

  const idSet = new Set(nodes.map((n) => n.id));
  const edges: CausalJsonEdge[] = data.edges.map((e, i) => {
    if (!isRecord(e)) {
      throw new CausalJsonError(`edges[${i}] 必須為物件`);
    }
    // 因果圖只有單向；舊檔的 "bidirectional" 讀入時視為單向
    if (
      e.direction !== undefined &&
      e.direction !== "one-way" &&
      e.direction !== "bidirectional"
    ) {
      throw new CausalJsonError(
        `edges[${i}].direction 若提供必須為 "one-way"`,
      );
    }
    const direction: CausalDirection = "one-way";
    const polarity = asString(e.polarity, `edges[${i}].polarity`);
    if (
      polarity !== "positive" &&
      polarity !== "negative" &&
      polarity !== "neutral"
    ) {
      throw new CausalJsonError(
        `edges[${i}].polarity 必須為 "positive"、"negative" 或 "neutral"`,
      );
    }
    const source = asString(e.source, `edges[${i}].source`);
    const target = asString(e.target, `edges[${i}].target`);
    if (!idSet.has(source)) {
      throw new CausalJsonError(`edges[${i}].source 找不到節點 "${source}"`);
    }
    if (!idSet.has(target)) {
      throw new CausalJsonError(`edges[${i}].target 找不到節點 "${target}"`);
    }
    let bend: { dx: number; dy: number } | undefined;
    if (e.bend !== undefined) {
      if (!isRecord(e.bend)) {
        throw new CausalJsonError(`edges[${i}].bend 必須為 { dx, dy } 物件`);
      }
      bend = {
        dx: asNumber(e.bend.dx, `edges[${i}].bend.dx`),
        dy: asNumber(e.bend.dy, `edges[${i}].bend.dy`),
      };
    }
    for (const key of ["sourceSide", "targetSide"] as const) {
      const v = e[key];
      if (v !== undefined && v !== "in" && v !== "out") {
        throw new CausalJsonError(`edges[${i}].${key} 必須為 "in" 或 "out"`);
      }
    }
    return {
      id: asString(e.id, `edges[${i}].id`),
      source,
      target,
      direction: direction as CausalDirection,
      polarity: polarity as CausalPolarity,
      ...(bend ? { bend } : {}),
      ...(e.sourceSide === "in" ? { sourceSide: "in" as const } : {}),
      ...(e.targetSide === "out" ? { targetSide: "out" as const } : {}),
    };
  });

  const title =
    data.title === undefined
      ? undefined
      : typeof data.title === "string"
        ? data.title
        : (() => {
            throw new CausalJsonError("title 若存在必須為字串");
          })();

  return { causalflowVersion: CAUSAL_JSON_VERSION, title, nodes, edges };
}

export function stringifyCausalJson(doc: CausalJsonDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** 給 AI 的快速規格（與 IMPORT_JSON.md 同步維護） */
export const CAUSAL_JSON_AI_GUIDE = `CausalFlow JSON 快速規格（causalflowVersion: 1）

最重要三件事：
1) causalflowVersion 必須是數字 1
2) nodes 與 edges 都必填且為陣列
3) 每條 edge 的 source/target 都必須引用存在的 node id

固定骨架：
{
  "causalflowVersion": 1,
  "title": "可選",
  "nodes": [],
  "edges": []
}

nodes[] 每個元素：
- id: string（非空白）
- label: string（非空白）
- x: number（有限數字）
- y: number（有限數字）
- flipped: true（選填；輸入／輸出邊互換）

edges[] 每個元素：
- id: string（非空白）
- source: string（必須存在於 nodes[].id）
- target: string（必須存在於 nodes[].id）
- direction: "one-way"（選填，可省略；因果圖只有單向）
- polarity: "positive" | "negative" | "neutral"
- bend: { "dx": number, "dy": number }（選填；連線彎曲，通常不需提供）
- sourceSide / targetSide: "in" | "out"（選填；連線接在節點的輸入側或輸出側，預設 source 用 out、target 用 in）

可直接給 AI 的輸出要求：
「請輸出可直接匯入 CausalFlow 的純 JSON（不要 Markdown code block），並嚴格符合以上欄位與枚舉。」
`;

export const CAUSAL_JSON_NOTEBOOKLM_WARNING =
  "不要把這份指南直接放進 NotebookLM 來源；請在對話中要求 AI 依本規格產生 JSON，再把 JSON 匯入 CausalFlow。";
