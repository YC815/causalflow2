# 連線彎曲、節點翻轉、移除雙向 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除雙向連線；連線可拖曳單一控制點改變形狀；節點可翻轉輸入／輸出邊。

**Architecture:** 幾何計算抽成純函式 `lib/edge-geometry.ts`；連線形狀存成 `CausalEdgeData.bend`（相對中點偏移），節點翻轉存成 `CausalNodeData.flipped`；兩者都經 store action 變更（undo-aware），JSON 以選填欄位向後相容。

**Tech Stack:** Next.js 16 / React 19 / @xyflow/react 12.10 / zustand 5 / vitest / pnpm

**Spec:** `docs/superpowers/specs/2026-10-01-edge-bend-node-flip-design.md`

## Global Constraints

- 套件管理一律 `pnpm`。不得在前景執行 `pnpm dev` 或 watch 指令。
- 每個 task 結束前必跑：`pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm test`，全部通過才 commit。不得用 eslint-disable 掩蓋。
- UI 文字一律繁體中文；註解沿用現有風格（繁中、精簡）。
- JSON 向後相容：舊檔（含 `"direction": "bidirectional"` 或沒有 bend／flipped）必須能讀；寫出固定 `"direction": "one-way"`；`bend` 只在有值時輸出、`flipped` 只在 true 時輸出。
- `bend` 定義：`{ dx, dy }` = 控制點 − (source 端點與 target 端點的中點)，flow 座標。
- 一鍵排版／切換橫直式：清除所有 bend，保留 flipped，同一次 commit。
- 快捷鍵：`F` 翻轉選取節點；`B` 移除（不再有雙向）。
- 匯出 PNG／PDF 期間（store `exporting` 為 true）不畫連線控制點與節點翻轉按鈕。

---

### Task 1: 移除雙向連線

**Files:**
- Modify: `components/causal/causal-edge.tsx`, `components/causal/flow-adapters.ts`, `lib/causal-json.ts`, `lib/sample-causal.ts`, `lib/store/causal-store.ts`, `components/causal/toolbar.tsx`, `components/causal/inspector.tsx`, `components/causal/canvas-context-menu.tsx`, `components/causal/use-causal-commands.ts`, `components/causal/use-hotkeys.ts`, `components/causal/shortcuts-dialog.tsx`, `README.md`, `IMPORT_JSON.md`
- Test: `lib/causal-json.test.ts`（新）、`lib/clipboard.test.ts`、`lib/store/causal-store.test.ts`（必要時更新）

**Interfaces:**
- Produces: `CausalEdgeData = { polarity: CausalPolarity }`（Task 2 會再加 `bend?`）；`CausalDirection = "one-way"`；`CausalJsonEdge.direction: "one-way"`；`newFlowEdge(id, source, target, defaults: { polarity })`；store 不再有 `defaultBidirectional`／`setDefaultBidirectional`；commands 不再有 `toggleSelectedEdgeDirection`。

- [ ] **Step 1: 寫 JSON 相容測試（先失敗）**

建立 `lib/causal-json.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { parseCausalJson, stringifyCausalJson } from "./causal-json";

const base = (edge: Record<string, unknown>) =>
  JSON.stringify({
    causalflowVersion: 1,
    nodes: [
      { id: "a", label: "A", x: 0, y: 0 },
      { id: "b", label: "B", x: 1, y: 1 },
    ],
    edges: [{ id: "ab", source: "a", target: "b", polarity: "positive", ...edge }],
  });

describe("parseCausalJson direction", () => {
  it("accepts missing direction as one-way", () => {
    expect(parseCausalJson(base({})).edges[0].direction).toBe("one-way");
  });
  it("downgrades legacy bidirectional to one-way", () => {
    expect(parseCausalJson(base({ direction: "bidirectional" })).edges[0].direction).toBe("one-way");
  });
  it("rejects unknown direction values", () => {
    expect(() => parseCausalJson(base({ direction: "both" }))).toThrow();
  });
  it("round-trips with direction one-way", () => {
    const doc = parseCausalJson(base({ direction: "one-way" }));
    expect(parseCausalJson(stringifyCausalJson(doc))).toEqual(doc);
  });
});
```

Run `pnpm test` → 「missing direction」與「bidirectional」兩案應失敗（目前 direction 必填、型別包含 bidirectional 但值不轉換）。

- [ ] **Step 2: `lib/causal-json.ts`**
  - `export type CausalDirection = "one-way";`
  - parse edges：`direction` 改為：`undefined` → `"one-way"`；字串 `"one-way"` 或 `"bidirectional"` → `"one-way"`；其他 → `throw new CausalJsonError(\`edges[${i}].direction 若提供必須為 "one-way"\`)`。不再呼叫 `asString(e.direction, …)`。
  - `CAUSAL_JSON_AI_GUIDE`：edges 的 direction 行改為 `- direction: "one-way"（選填，可省略；因果圖只有單向）`。

- [ ] **Step 3: 連線資料與繪製**
  - `causal-edge.tsx`：`CausalEdgeData = { polarity: CausalPolarity }`；移除 `markerStart`／`bidirectional` 相關 props 與邏輯，`BaseEdge` 只傳 `markerEnd`。
  - `flow-adapters.ts`：`jsonEdgeToFlow` 不再設 `markerStart`、`data: { polarity }`；`flowToDocument` 每條 edge 輸出 `direction: "one-way"`；`newFlowEdge(id, source, target, defaults: CausalEdgeData)` 只設 `markerEnd`；`withMarkers` 只設 `markerEnd`，fallback data 為 `{ polarity: "positive" }`。
  - `lib/sample-causal.ts`：`e-traffic-mood` 的 direction 改 `"one-way"`。

- [ ] **Step 4: store**（`lib/store/causal-store.ts`）
  - 移除 state `defaultBidirectional` 與 action `setDefaultBidirectional`（型別與實作）。
  - `edgeDefaults()` 回 `{ polarity: get().defaultPolarity }`。
  - `updateEdge` 的 data 合併改為 `{ polarity: e.data?.polarity ?? "positive", ...patch }`。

- [ ] **Step 5: UI 移除雙向入口**
  - `toolbar.tsx`：「新連線預設」移除單向／雙向兩顆 chip 與相關 selector。
  - `inspector.tsx`：移除「改單向／改雙向」按鈕。
  - `canvas-context-menu.tsx`：移除「切換單／雙向」項目。
  - `use-causal-commands.ts`：移除 `toggleSelectedEdgeDirection`。
  - `use-hotkeys.ts`：移除 `b` 分支。
  - `shortcuts-dialog.tsx`：移除 `B` 列。
  - `README.md`：連線極性列移除「`B` 切單／雙向」。
  - `IMPORT_JSON.md`：3.3 表格 `direction` 改為「否｜固定 `"one-way"`（可省略；舊檔的 `"bidirectional"` 讀入時視為單向）」；其他提到 bidirectional 的地方同步改寫；範例 JSON 不出現 bidirectional。

- [ ] **Step 6: 修正既有測試**

`lib/clipboard.test.ts`：DOC 中 `bc` 的 direction 改 `"one-way"`；`edges[1].data` 的預期改為 `{ polarity: "negative" }`。其他測試若引用 bidirectional 一併修正。

- [ ] **Step 7: 驗證與 commit**

```bash
grep -rn "bidirectional" --include=*.ts --include=*.tsx components lib app | grep -v "causal-json" 
```
Expected：無輸出（只有 causal-json.ts 的相容轉換與其測試可出現此字）。

`pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` 全過後 commit：`refactor(causal): remove bidirectional edges (one-way only, legacy JSON accepted)`。

---

### Task 2: 幾何函式＋JSON 欄位 bend／flipped

**Files:**
- Create: `lib/edge-geometry.ts`, `lib/edge-geometry.test.ts`
- Modify: `lib/causal-json.ts`, `lib/causal-json.test.ts`, `components/causal/flow-adapters.ts`, `components/causal/causal-edge.tsx`（只改型別）, `components/causal/causal-node.tsx`（只改型別）

**Interfaces:**
- Produces:
  - `type Pt = { x: number; y: number }`、`type Bend = { dx: number; dy: number }`
  - `midpoint(s: Pt, t: Pt): Pt`
  - `bendPoint(s: Pt, t: Pt, bend: Bend): Pt` = midpoint + bend
  - `bendFromPoint(s: Pt, t: Pt, p: Pt): Bend` = p − midpoint
  - `bentEdgePath(s: Pt, t: Pt, bend: Bend): { path: string; point: Pt }` — 二次貝茲 `M sx,sy Q cx,cy tx,ty`，C = 2P − midpoint
  - `CausalEdgeData = { polarity: CausalPolarity; bend?: Bend }`
  - `CausalNodeData = { label: string; flipped?: boolean }`
  - `CausalJsonNode.flipped?: true`、`CausalJsonEdge.bend?: Bend`

- [ ] **Step 1: 幾何測試（先失敗）** `lib/edge-geometry.test.ts`：

```ts
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
```

- [ ] **Step 2: 實作** `lib/edge-geometry.ts`：

```ts
/** 連線彎曲的幾何計算（flow 座標，純函式） */

export type Pt = { x: number; y: number };
export type Bend = { dx: number; dy: number };

export function midpoint(s: Pt, t: Pt): Pt {
  return { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
}

export function bendPoint(s: Pt, t: Pt, bend: Bend): Pt {
  const m = midpoint(s, t);
  return { x: m.x + bend.dx, y: m.y + bend.dy };
}

export function bendFromPoint(s: Pt, t: Pt, p: Pt): Bend {
  const m = midpoint(s, t);
  return { dx: p.x - m.x, dy: p.y - m.y };
}

/** 二次貝茲；控制點取 2P − 中點，使曲線在 t=0.5 恰好經過 P */
export function bentEdgePath(
  s: Pt,
  t: Pt,
  bend: Bend,
): { path: string; point: Pt } {
  const point = bendPoint(s, t, bend);
  const m = midpoint(s, t);
  const c = { x: 2 * point.x - m.x, y: 2 * point.y - m.y };
  return { path: `M ${s.x},${s.y} Q ${c.x},${c.y} ${t.x},${t.y}`, point };
}
```

- [ ] **Step 3: JSON 測試（先失敗）** 在 `lib/causal-json.test.ts` 追加：

```ts
describe("parseCausalJson bend/flipped", () => {
  const doc = (node: Record<string, unknown>, edge: Record<string, unknown>) =>
    JSON.stringify({
      causalflowVersion: 1,
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, ...node },
        { id: "b", label: "B", x: 1, y: 1 },
      ],
      edges: [{ id: "ab", source: "a", target: "b", polarity: "positive", ...edge }],
    });

  it("reads bend and flipped", () => {
    const d = parseCausalJson(doc({ flipped: true }, { bend: { dx: 1, dy: -2 } }));
    expect(d.nodes[0].flipped).toBe(true);
    expect(d.edges[0].bend).toEqual({ dx: 1, dy: -2 });
  });
  it("omits flipped when false and bend when absent", () => {
    const d = parseCausalJson(doc({ flipped: false }, {}));
    expect("flipped" in d.nodes[0]).toBe(false);
    expect("bend" in d.edges[0]).toBe(false);
  });
  it("rejects invalid bend and flipped", () => {
    expect(() => parseCausalJson(doc({}, { bend: { dx: "1", dy: 0 } }))).toThrow();
    expect(() => parseCausalJson(doc({}, { bend: [1, 2] }))).toThrow();
    expect(() => parseCausalJson(doc({ flipped: "yes" }, {}))).toThrow();
  });
});
```

- [ ] **Step 4: 實作 JSON 欄位**（`lib/causal-json.ts`）
  - 型別：`CausalJsonNode` 加 `flipped?: true`；`CausalJsonEdge` 加 `bend?: { dx: number; dy: number }`。
  - nodes parse：`n.flipped` 若 `undefined` 略過；非 boolean → `CausalJsonError(\`nodes[${i}].flipped 若提供必須為 true 或 false\`)`；為 true 才放入結果（`...(n.flipped === true ? { flipped: true as const } : {})`）。
  - edges parse：`e.bend` 若 `undefined` 略過；非物件（`isRecord`）→ `CausalJsonError(\`edges[${i}].bend 必須為 { dx, dy } 物件\`)`；`dx`、`dy` 用 `asNumber(…, \`edges[${i}].bend.dx\`)`；有值才放入結果。
  - `CAUSAL_JSON_AI_GUIDE`：nodes 加 `- flipped: true（選填；輸入／輸出邊互換）`；edges 加 `- bend: { "dx": number, "dy": number }（選填；連線彎曲，通常不需提供）`。

- [ ] **Step 5: 型別與 adapters**
  - `causal-edge.tsx`：`CausalEdgeData = { polarity: CausalPolarity; bend?: Bend }`（`import type { Bend } from "@/lib/edge-geometry"`）。本 task 不改繪製。
  - `causal-node.tsx`：`CausalNodeData = { label: string; flipped?: boolean }`。本 task 不改繪製。
  - `flow-adapters.ts`：`jsonNodeToFlow` 的 data 加 `...(n.flipped ? { flipped: true } : {})`；`jsonEdgeToFlow` 的 data 加 `...(e.bend ? { bend: e.bend } : {})`；`flowToDocument` node 加 `...(n.data.flipped ? { flipped: true as const } : {})`、edge 加 `...(data.bend ? { bend: data.bend } : {})`。

- [ ] **Step 6:** 驗證全過後 commit：`feat(causal): add edge bend / node flip to data model and JSON`。

---

### Task 3: store 動作＋翻轉下游位置

**Files:**
- Modify: `lib/store/causal-store.ts`, `lib/store/causal-store.test.ts`, `lib/placement.ts`, `lib/placement.test.ts`

**Interfaces:**
- Produces（store）：
  - `setEdgeBend(id: string, bend: Bend | null): void` — 不 commit；null 時把 data.bend 設為 undefined
  - `resetEdgeBend(id: string): void` — 該邊沒有 bend 則不動作；否則 commit 後清除
  - `toggleFlip(ids: string[]): void` — ids 為空不動作；否則 commit 後逐一切換 `data.flipped`（false → 設為 undefined）
  - `applyLayout` 額外清除所有邊的 bend（同一次 commit）
- Produces（placement）：`downstreamPosition(from, direction, others, flipped = false)` — flipped 時 LR：`x = from.x − DEFAULT_NODE_SIZE.width − 80`，TB：`y = from.y − DEFAULT_NODE_SIZE.height − 80`；其餘同原規則（含重疊推移）。

- [ ] **Step 1: 測試（先失敗）**

`lib/store/causal-store.test.ts` 追加（沿用檔案既有的 DOC／`s()`／beforeEach）：

```ts
describe("bend and flip", () => {
  it("setEdgeBend does not record history; resetEdgeBend does", () => {
    const before = s().history.past.length;
    s().setEdgeBend("ab", { dx: 5, dy: 6 });
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
    expect(s().history.past.length).toBe(before);
    s().resetEdgeBend("ab");
    expect(s().edges[0].data?.bend).toBeUndefined();
    expect(s().history.past.length).toBe(before + 1);
    s().undo();
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
  });
  it("resetEdgeBend without bend is a no-op", () => {
    const before = s().history.past.length;
    s().resetEdgeBend("ab");
    expect(s().history.past.length).toBe(before);
  });
  it("toggleFlip flips and is undoable", () => {
    s().toggleFlip(["a"]);
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
    s().toggleFlip(["a"]);
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBeUndefined();
    s().undo();
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
  });
  it("applyLayout clears bends but keeps flips", () => {
    s().setEdgeBend("ab", { dx: 5, dy: 6 });
    s().toggleFlip(["a"]);
    s().applyLayout("LR");
    expect(s().edges[0].data?.bend).toBeUndefined();
    expect(s().nodes.find((n) => n.id === "a")?.data.flipped).toBe(true);
    s().undo();
    expect(s().edges[0].data?.bend).toEqual({ dx: 5, dy: 6 });
  });
});
```

`lib/placement.test.ts` 追加：

```ts
it("flipped downstream goes left in LR and up in TB", () => {
  expect(downstreamPosition(FROM, "LR", [FROM], true)).toEqual({ x: -240, y: 0 });
  expect(downstreamPosition(FROM, "TB", [FROM], true)).toEqual({ x: 0, y: -140 });
});
```

- [ ] **Step 2: 實作**（照 Interfaces；`import type { Bend } from "@/lib/edge-geometry"`）
- [ ] **Step 3:** `use-causal-commands.ts` 的 `createDownstream` 改為 `downstreamPosition(nodeRect(n), store().layoutDirection, allRects(), Boolean(n.data.flipped))`。
- [ ] **Step 4:** 驗證全過後 commit：`feat(store): edge bend and node flip actions`。

---

### Task 4: 連線彎曲 UI

**Files:**
- Modify: `components/causal/causal-edge.tsx`, `components/causal/use-causal-commands.ts`, `components/causal/canvas-context-menu.tsx`

**Interfaces:**
- Consumes: `bentEdgePath`, `bendFromPoint`（Task 2）；store `setEdgeBend`, `resetEdgeBend`, `commit`, `exporting`（Task 3）。
- Produces: commands `resetSelectedEdgeBend()`。

- [ ] **Step 1: 繪製** — `CausalEdge`：
  - `const bend = data?.bend`。有 bend：`const { path, point } = bentEdgePath({x:sourceX,y:sourceY},{x:targetX,y:targetY}, bend)`；否則沿用 `getBezierPath`，point = `{ x: labelX, y: labelY }`。
  - 極性徽章畫在 `point`。
  - `const exporting = useCausalStore((s) => s.exporting)`；`selected && !exporting` 時在 `point` 畫 `BendHandle`。

- [ ] **Step 2: BendHandle**（同檔案內）：

```tsx
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
        commit();
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
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
```

注意：
  - 只按下沒拖曳（pointerdown 後沒有 move）會留下一筆無變化的 commit；改為：在 pointerdown 記 `movedRef = false`，第一次 move 時才 `commit()` 並設 `movedRef = true`（用 `useRef`）。
  - 中性極性（沒有徽章）時控制圈仍畫，半徑同上。
  - 把 `source`／`target`（`{x:sourceX,y:sourceY}`、`{x:targetX,y:targetY}`）傳入。

- [ ] **Step 3:** commands 加 `resetSelectedEdgeBend: () => { const id = singleSelectedEdgeId(); if (id) store().resetEdgeBend(id); }`；右鍵連線選單在「反轉方向」後加「重設彎曲」（`disabled` 當該邊沒有 bend 時可省略，直接呼叫即可——無 bend 時 store 不動作）。
- [ ] **Step 4:** 驗證全過後 commit：`feat(causal): draggable edge bend handle`。

---

### Task 5: 節點翻轉 UI

**Files:**
- Modify: `components/causal/causal-node.tsx`, `components/causal/use-causal-commands.ts`, `components/causal/canvas-context-menu.tsx`, `components/causal/use-hotkeys.ts`, `components/causal/shortcuts-dialog.tsx`, `components/causal/causal-flow-app.tsx`（命令面板 actions）, `README.md`

**Interfaces:**
- Consumes: store `toggleFlip`（Task 3）。
- Produces: commands `toggleFlipSelected(): boolean`（選取節點 ≥1 才動作並回 true）。

- [ ] **Step 1: Handle 位置** — `CausalNode`：
  ```ts
  const flipped = Boolean(data.flipped);
  const horizontal = orientation === "horizontal";
  const inSide = horizontal ? Position.Left : Position.Top;
  const outSide = horizontal ? Position.Right : Position.Bottom;
  const targetPos = flipped ? outSide : inSide;
  const sourcePos = flipped ? inSide : outSide;
  ```
  `useLayoutEffect` 依賴加入 `flipped`，確保 `updateNodeInternals(id)`。

- [ ] **Step 2: 翻轉按鈕** — 在節點內加 `NodeToolbar`（`import { NodeToolbar } from "@xyflow/react"`）：
  - `isVisible`：本節點 `selected`、不在編輯、store `exporting` 為 false、且全圖恰好一個選取節點（selector：`s.nodes.filter((n) => n.selected).length === 1`）。
  - `position={Position.Top}`，內容為一顆 `button`：lucide `ArrowLeftRight`（橫式）或 `ArrowUpDown`（直式），`title="翻轉輸入／輸出（F）"`、`aria-label` 同，`onClick={() => toggleFlip([id])}`，樣式沿用 `ui-classes.ts` 的 `shellBtn`。

- [ ] **Step 3:** commands 加：
  ```ts
  toggleFlipSelected: (): boolean => {
    const ids = store().nodes.filter((n) => n.selected).map((n) => n.id);
    if (ids.length === 0) return false;
    store().toggleFlip(ids);
    return true;
  },
  ```
- [ ] **Step 4:** 入口
  - `use-hotkeys.ts`：非修飾鍵分支加 `if (e.key.toLowerCase() === "f") return consume(commands.toggleFlipSelected());`
  - `canvas-context-menu.tsx`：node 選單與 selection 選單各加「翻轉輸入／輸出」（`ContextMenuShortcut` 顯示 `F`）。
  - `causal-flow-app.tsx` 的 `paletteActions` 加 `{ id: "flip", label: "翻轉選取節點的輸入／輸出", shortcut: "F", run: () => void commands.toggleFlipSelected() }`。
  - `shortcuts-dialog.tsx`：「建立與編輯」群組加 `{ keys: [["F"]], label: "翻轉輸入／輸出" }`；「連線」群組加說明列 `{ keys: [["拖曳圓圈"]], label: "改變連線形狀（雙擊重設）" }`。
  - `README.md` 操作表加兩列：「翻轉節點輸入／輸出｜選取後按 `F`，或節點上方 ⇄ 按鈕」、「改變連線形狀｜選取連線後拖曳中間的圓圈；雙擊圓圈重設」。
- [ ] **Step 5:** 驗證全過後 commit：`feat(causal): flip node input/output sides`。

---

### Task 6: UI 驗收（ego-browser）

- [ ] 背景啟動 `pnpm dev`，清 localStorage，逐項記錄 PASS／FAIL：
  1. 工具列、Inspector、右鍵、快捷鍵一覽都已沒有雙向相關選項；按 `B` 無作用。
  2. 匯入一份含 `"direction": "bidirectional"` 的 JSON → 成功，連線為單向。
  3. 選取連線 → 中點出現虛線圈；拖曳 → 曲線穿過圓圈、箭頭沿曲線方向、極性徽章跟著移動。
  4. 拖完按 ⌘/Ctrl+Z → 一次回到拖曳前；⌘/Ctrl+Shift+Z → 回來。
  5. 只點一下圓圈不拖 → 歷史不增加（復原按鈕狀態不變）。
  6. 雙擊圓圈 → 回到預設曲線；右鍵「重設彎曲」同效果。
  7. 拖動彎曲連線的一端節點 → 曲線跟著移動、形狀大致保持。
  8. 一鍵排版 → 所有彎曲消失；復原 → 彎曲回來。
  9. 重新整理 → 彎曲保留；匯出 JSON 含 `bend`、未彎曲的邊沒有 `bend`。
  10. 選取單一節點 → 上方出現 ⇄；點擊 → 輸入點到右、輸出點到左，既有連線端點跟著改。
  11. 按 `F`、右鍵「翻轉輸入／輸出」、命令面板皆可翻轉；多選後按 `F` 全部翻轉；可復原。
  12. 切直式 → 翻轉的節點變成上下互換；一鍵排版後翻轉保留。
  13. 對翻轉節點按 Tab → 新節點出現在左側（橫式）。
  14. 匯出 PNG／PDF → 圖中沒有虛線圈與 ⇄ 按鈕。
- [ ] 失敗項：找根因、最小修正、重跑 `tsc/lint/test/build` 與相關檢查，各自 commit。
- [ ] 關閉 dev server。
