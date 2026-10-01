# 單條連線選擇接點側 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每條連線的兩端可各自接在節點的輸入側或輸出側。

**Architecture:** 每個節點兩個 `type="source"` 的 Handle（id `in`／`out`）＋ React Flow loose 連線模式；連線以 `sourceHandle`／`targetHandle` 記錄側別；JSON 以選填 `sourceSide`／`targetSide` 向後相容；所有變更經 undo-aware store action。

**Tech Stack:** Next.js 16 / React 19 / @xyflow/react 12.10 / zustand 5 / vitest / pnpm

**Spec:** `docs/superpowers/specs/2026-10-01-edge-sides-design.md`

## Global Constraints

- pnpm only；不得前景跑 `pnpm dev`／watch。每個 task 結束前 `pnpm exec tsc --noEmit && pnpm lint && pnpm test` 全過才 commit；不得 eslint-disable。
- UI 文字繁中；註解繁中精簡。
- Handle id 固定 `"in"`、`"out"`，兩者 `type="source"`；`connectionMode={ConnectionMode.Loose}`。
- 每條 flow edge 必帶 `sourceHandle`（預設 `"out"`）與 `targetHandle`（預設 `"in"`）。
- JSON：`sourceSide`／`targetSide` 選填，值限 `"in"`／`"out"`；只在非預設時輸出。舊檔照讀。
- 自環一律拒絕：toast `不能連到自己`。重複（同 source→target）沿用 toast `兩節點之間已有連線`。
- 每個使用者操作恰好一筆 undo；被拒絕的操作不記歷史。

---

### Task 1: 資料模型、JSON、store

**Files:**
- Modify: `lib/causal-json.ts`, `lib/causal-json.test.ts`, `components/causal/flow-adapters.ts`, `lib/store/causal-store.ts`, `lib/store/causal-store.test.ts`
- Test fixtures: 若既有測試以 `toEqual` 比對整個 flow edge 而因新增 handle 欄位失敗，更新預期值。

**Interfaces:**
- Produces:
  - `export type HandleSide = "in" | "out"`（`lib/causal-json.ts`）
  - `CausalJsonEdge.sourceSide?: "in"`、`targetSide?: "out"`（parse 後只保留非預設值）
  - `newFlowEdge(id, source, target, defaults, sides?: { source?: HandleSide; target?: HandleSide })` — 一律設定 `sourceHandle`（預設 `"out"`）、`targetHandle`（預設 `"in"`）
  - `jsonEdgeToFlow` 設 `sourceHandle: e.sourceSide ?? "out"`、`targetHandle: e.targetSide ?? "in"`；`flowToDocument` 在 `sourceHandle === "in"` 時輸出 `sourceSide: "in"`、`targetHandle === "out"` 時輸出 `targetSide: "out"`
  - store：
    - `SELF_LOOP_MESSAGE = "不能連到自己"`（export）
    - `connect(source, target, sides?: { source?: HandleSide; target?: HandleSide }): boolean` — 自環 → toast＋false（不 commit）；重複 → 既有行為；成功時邊帶側別
    - `reconnectEdge(id: string, next: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }): boolean` — 自環或與「其他」邊重複 → toast＋false（不 commit）；否則 commit 並更新該邊 source/target/sourceHandle（null/undefined → `"out"`）/targetHandle（→ `"in"`）
    - `toggleEdgeSide(id: string, end: "source" | "target"): void` — commit 後把該端 `"in"`↔`"out"`
    - `reverseEdge` 交換兩端後，`sourceHandle`／`targetHandle` 重設為 `"out"`／`"in"`
    - `addConnectedNode(anchorId, position, side, opts?: { flipped?: boolean; anchorHandle?: HandleSide })` — `anchorHandle` 用於錨點那一端（downstream：source 端；upstream：target 端），未給則用預設

- [ ] **Step 1: JSON 測試（先失敗）** — 追加到 `lib/causal-json.test.ts`：

```ts
describe("parseCausalJson sides", () => {
  const doc = (edge: Record<string, unknown>) =>
    JSON.stringify({
      causalflowVersion: 1,
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 1, y: 1 },
      ],
      edges: [{ id: "ab", source: "a", target: "b", polarity: "positive", ...edge }],
    });

  it("keeps non-default sides", () => {
    const e = parseCausalJson(doc({ sourceSide: "in", targetSide: "out" })).edges[0];
    expect(e.sourceSide).toBe("in");
    expect(e.targetSide).toBe("out");
  });
  it("drops default sides", () => {
    const e = parseCausalJson(doc({ sourceSide: "out", targetSide: "in" })).edges[0];
    expect("sourceSide" in e).toBe(false);
    expect("targetSide" in e).toBe(false);
  });
  it("rejects invalid sides", () => {
    expect(() => parseCausalJson(doc({ sourceSide: "left" }))).toThrow();
    expect(() => parseCausalJson(doc({ targetSide: 1 }))).toThrow();
  });
});
```

並在 `lib/clipboard.test.ts` 或新測試中驗證 adapter round-trip：`jsonEdgeToFlow({..., sourceSide: "in"})` 得到 `sourceHandle: "in", targetHandle: "in"`；`flowToDocument` 對預設側別的邊不輸出 `sourceSide`／`targetSide`。

- [ ] **Step 2: 實作 JSON**：parse 時 `sourceSide`／`targetSide` 若非 undefined 必須為 `"in"` 或 `"out"`，否則 `CausalJsonError(\`edges[${i}].sourceSide 必須為 "in" 或 "out"\`)`（targetSide 同理）；只保留 `sourceSide === "in"`、`targetSide === "out"`。AI 指南 edges 加 `- sourceSide / targetSide: "in" | "out"（選填；連線接在節點的輸入側或輸出側，預設 source 用 out、target 用 in）`。

- [ ] **Step 3: store 測試（先失敗）** — 追加到 `lib/store/causal-store.test.ts`（沿用 DOC：節點 a,b,c、邊 ab）：

```ts
describe("edge sides", () => {
  it("edges loaded from JSON carry default handles", () => {
    const e = s().edges.find((x) => x.id === "ab")!;
    expect([e.sourceHandle, e.targetHandle]).toEqual(["out", "in"]);
  });
  it("connect stores sides and rejects self loops", () => {
    expect(s().connect("b", "c", { source: "in", target: "out" })).toBe(true);
    const e = s().edges.find((x) => x.source === "b" && x.target === "c")!;
    expect([e.sourceHandle, e.targetHandle]).toEqual(["in", "out"]);
    const before = s().history.past.length;
    expect(s().connect("a", "a")).toBe(false);
    expect(s().toast).toBe(SELF_LOOP_MESSAGE);
    expect(s().history.past.length).toBe(before);
  });
  it("reconnectEdge moves an end, is undoable, and rejects duplicates and self loops", () => {
    expect(s().reconnectEdge("ab", { source: "a", target: "b", sourceHandle: "out", targetHandle: "out" })).toBe(true);
    expect(s().edges.find((x) => x.id === "ab")!.targetHandle).toBe("out");
    s().undo();
    expect(s().edges.find((x) => x.id === "ab")!.targetHandle).toBe("in");
    s().connect("a", "c");
    const before = s().history.past.length;
    expect(s().reconnectEdge("ab", { source: "a", target: "c" })).toBe(false);
    expect(s().reconnectEdge("ab", { source: "b", target: "b" })).toBe(false);
    expect(s().history.past.length).toBe(before);
  });
  it("toggleEdgeSide flips one end", () => {
    s().toggleEdgeSide("ab", "target");
    expect(s().edges.find((x) => x.id === "ab")!.targetHandle).toBe("out");
    s().toggleEdgeSide("ab", "source");
    expect(s().edges.find((x) => x.id === "ab")!.sourceHandle).toBe("in");
  });
  it("reverseEdge resets sides", () => {
    s().toggleEdgeSide("ab", "target");
    s().reverseEdge("ab");
    const e = s().edges.find((x) => x.id === "ab")!;
    expect([e.source, e.target, e.sourceHandle, e.targetHandle]).toEqual(["b", "a", "out", "in"]);
  });
  it("addConnectedNode uses anchorHandle on the anchor end", () => {
    const id = s().addConnectedNode("a", { x: 0, y: 200 }, "downstream", { anchorHandle: "in" });
    const e = s().edges.find((x) => x.source === "a" && x.target === id)!;
    expect([e.sourceHandle, e.targetHandle]).toEqual(["in", "in"]);
  });
});
```

（import `SELF_LOOP_MESSAGE`。）

- [ ] **Step 4: 實作 adapters 與 store**（照 Interfaces）。
- [ ] **Step 5:** 驗證全過後 commit：`feat(causal): per-edge handle sides in data model and store`。

---

### Task 2: UI

**Files:**
- Modify: `components/causal/causal-node.tsx`, `components/causal/causal-flow-app.tsx`, `components/causal/canvas-context-menu.tsx`, `components/causal/use-causal-commands.ts`, `components/causal/shortcuts-dialog.tsx`, `README.md`, `IMPORT_JSON.md`

**Interfaces:**
- Consumes: Task 1 store/adapters。
- Produces: commands `toggleSelectedEdgeSide(end: "source" | "target"): void`；`addConnectedNodeAtScreen(anchorId, point, side, anchorHandle?: HandleSide)`。

- [ ] **Step 1: 節點接點** — `causal-node.tsx`：把現有兩個 Handle 改為
  ```tsx
  <Handle id="in" type="source" position={inPos} className={...同現有} />
  <Handle id="out" type="source" position={outPos} className={...同現有} />
  ```
  其中 `inPos`／`outPos` 沿用現有翻轉邏輯（未翻轉：in=輸入側、out=輸出側；翻轉則互換）。輸入側 handle 外觀可維持現狀（同樣式）。
- [ ] **Step 2: React Flow 設定** — `causal-flow-app.tsx`：
  - `connectionMode={ConnectionMode.Loose}`（`import { ConnectionMode } from "@xyflow/react"`）。
  - `onConnect={(c) => { if (c.source && c.target) connect(c.source, c.target, { source: asSide(c.sourceHandle), target: asSide(c.targetHandle) }); }}`；`asSide(h)` 回傳 `h === "in" || h === "out" ? h : undefined`（放在該檔頂部的小函式）。
  - `edgesReconnectable` 與 `onReconnect={(oldEdge, c) => reconnectEdge(oldEdge.id, c)}`（store 的 `reconnectEdge`）。
  - 用 `const reconnectingRef = useRef(false)`；`onReconnectStart={() => { reconnectingRef.current = true; }}`、`onReconnectEnd={() => { reconnectingRef.current = false; }}`；既有 `onConnectEnd` 開頭加 `if (reconnectingRef.current) return;`（React Flow 在改接時也會呼叫 `onConnectEnd`，`onReconnectEnd` 的呼叫順序請讀 `node_modules/@xyflow/system` 確認；若 `onReconnectEnd` 先於 `onConnectEnd`，改為在 `onConnectEnd` 內判斷後再清除旗標，確保拖線頭到空白處絕不建立節點）。
  - `onConnectEnd` 建節點時：所有 handle 都是 source 型別，一律 downstream；把 `asSide(state.fromHandle?.id)` 當作 `anchorHandle` 傳給 `commands.addConnectedNodeAtScreen`。
- [ ] **Step 3: commands** — `use-causal-commands.ts`：
  - `addConnectedNodeAtScreen(anchorId, point, side, anchorHandle?)` 轉傳 `anchorHandle` 給 `store().addConnectedNode(..., { anchorHandle })`（保留既有 flipped 繼承）。
  - `toggleSelectedEdgeSide: (end) => { const id = singleSelectedEdgeId(); if (id) store().toggleEdgeSide(id, end); }`。
- [ ] **Step 4: 右鍵連線選單** — 在「反轉方向」後加「起點改接另一側」、「終點改接另一側」。
- [ ] **Step 5: 文件** — `shortcuts-dialog.tsx` 連線群組加說明列 `{ keys: [["拖曳線頭"]], label: "改接另一側或其他節點" }`；`README.md` 操作表加「改變連線接點｜拖曳線頭到節點另一側的接點；或右鍵連線『起點／終點改接另一側』」；`IMPORT_JSON.md` 3.3 表格加 `sourceSide`、`targetSide` 兩列（選填、`"in"`／`"out"`、預設 source=out／target=in）。
- [ ] **Step 6:** `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build` 全過後 commit：`feat(causal): choose handle side per edge`。

---

### Task 3: UI 驗收（ego-browser）

- [ ] 背景啟動 dev server（port 3000 若已有本目錄的 dev server 在跑可直接使用，不要殺掉別人的程序），清 localStorage，逐項 PASS／FAIL：
  1. 從 A 的輸出側拉到 B 的輸入側 → 一般連線，箭頭指向 B。
  2. 從 A 的輸入側拉到 B 的輸出側 → 連線從 A 左側出發、接到 B 右側，箭頭仍指向 B（A 是因）。
  3. 從 B 的接點拉到 A → 方向為 B→A（拖曳起點是因）。
  4. 拖既有連線的終點線頭到同節點另一側 → 改接成功；⌘Z 一次還原。
  5. 拖終點線頭到另一個節點 → 改接到該節點；若造成重複則 toast 並維持原狀。
  6. 拖線頭放到空白處 → 不建立任何節點，連線維持原狀。
  7. 從節點拉到自己另一側 → 拒絕並 toast「不能連到自己」。
  8. 右鍵「起點改接另一側」「終點改接另一側」生效、可復原。
  9. 反轉方向 → 兩端回到預設側。
  10. 從輸入側接點拉到空白處 → 建新節點，連線從錨點輸入側出發。
  11. 翻轉節點後，既有連線的側別跟著換邊（in/out 位置互換）。
  12. 重新整理後側別保留；匯出 JSON 只有非預設的邊含 `sourceSide`／`targetSide`。
  13. 彎曲控制點、Tab／Enter、複製貼上仍正常。
- [ ] 失敗項：找根因、最小修正、重跑靜態檢查與相關項目，各自 commit。
