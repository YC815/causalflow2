/**
 * CausalFlow JSON — 與畫布雙向轉換的單一格式。
 * 給人與給 AI 匯入時請遵守同一結構。
 */

export const CAUSAL_JSON_VERSION = 1 as const;

export type CausalDirection = "one-way" | "bidirectional";
export type CausalPolarity = "positive" | "negative";

export type CausalJsonNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type CausalJsonEdge = {
  id: string;
  source: string;
  target: string;
  direction: CausalDirection;
  polarity: CausalPolarity;
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
    return {
      id: asString(n.id, `nodes[${i}].id`),
      label: asString(n.label, `nodes[${i}].label`),
      x: asNumber(n.x, `nodes[${i}].x`),
      y: asNumber(n.y, `nodes[${i}].y`),
    };
  });

  const idSet = new Set(nodes.map((n) => n.id));
  const edges: CausalJsonEdge[] = data.edges.map((e, i) => {
    if (!isRecord(e)) {
      throw new CausalJsonError(`edges[${i}] 必須為物件`);
    }
    const direction = asString(e.direction, `edges[${i}].direction`);
    if (direction !== "one-way" && direction !== "bidirectional") {
      throw new CausalJsonError(
        `edges[${i}].direction 必須為 "one-way" 或 "bidirectional"`,
      );
    }
    const polarity = asString(e.polarity, `edges[${i}].polarity`);
    if (polarity !== "positive" && polarity !== "negative") {
      throw new CausalJsonError(
        `edges[${i}].polarity 必須為 "positive" 或 "negative"`,
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
    return {
      id: asString(e.id, `edges[${i}].id`),
      source,
      target,
      direction: direction as CausalDirection,
      polarity: polarity as CausalPolarity,
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

/** 給 AI / 人類的簡短規格說明（可貼在提示詞或文件） */
export const CAUSAL_JSON_AI_GUIDE = `CausalFlow JSON 規格（causalflowVersion: 1）

用途：描述「邏輯／因果」有向圖。節點為概念或變因；邊表示因果或影響關係。

頂層欄位：
- causalflowVersion：固定數字 1（必填）
- title：可選，圖的標題說明
- nodes：節點陣列（必填）
- edges：邊陣列（必填）

節點 nodes[]：
- id：字串，唯一識別
- label：顯示文字
- x, y：畫布座標（數字，像素）

邊 edges[]：
- id：字串，唯一識別
- source, target：必須對應既有節點 id；語意為「從 source 指向 target」
- direction：
  - "one-way"：單向箭頭（source → target）
  - "bidirectional"：雙向箭頭
- polarity：
  - "positive"：正相關／促進（實線）
  - "negative"：負相關／抑制（虛線）

範例：
{
  "causalflowVersion": 1,
  "title": "簡例",
  "nodes": [
    { "id": "a", "label": "雨量", "x": 120, "y": 160 },
    { "id": "b", "label": "河流水位", "x": 420, "y": 160 }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "a",
      "target": "b",
      "direction": "one-way",
      "polarity": "positive"
    }
  ]
}

約束：所有 edge 的 source/target 必須出現在 nodes 的 id 中；id 在各自陣列內建議唯一。`;
