# 連線彎曲、節點翻轉、移除雙向

日期：2026-10-01
分支：接在 `feat/usability-overhaul` 上繼續。

## 1. 連線彎曲（單一控制點）

**操作**
- 選中一條連線時，曲線中點出現一個可拖曳的圓點（控制點）。極性徽章（+/−）畫在控制點位置。
- 拖曳控制點 → 曲線平滑穿過控制點；箭頭方向跟隨曲線切線（SVG marker `orient=auto` 自然達成）。
- 雙擊控制點，或右鍵連線選「重設彎曲」→ 回到預設曲線。
- 一次拖曳 = 一步 undo（拖曳開始時 commit，過程中不記）。
- 匯出 PNG／PDF 期間不畫控制點。

**資料**
- `CausalEdgeData.bend?: { dx: number; dy: number }`：控制點相對「source 與 target 端點連線中點」的偏移。節點移動時曲線跟著走、形狀大致保持。
- 有 bend：路徑為二次貝茲 `M S Q C T`，其中 C = 2P − (S+T)/2，P = 中點 + bend（曲線在 t=0.5 恰好經過 P）。
- 無 bend：沿用 React Flow `getBezierPath`，控制點顯示在其 label 位置；開始拖曳時以該位置為起點。
- 一鍵排版、切換橫／直式：清除所有 bend（同一次 commit，可 undo）。

**JSON**
- `edges[].bend`：選填，`{ "dx": number, "dy": number }`，兩者皆須為有限數字；沒有彎曲時不輸出此欄位。

## 2. 節點翻轉（交換輸入／輸出邊）

**操作**
- 每個節點可單獨翻轉：橫式時 target handle 改在右、source 改在左；直式時上下互換。再翻一次復原。可 undo。
- 入口：選中單一節點時節點上方出現 ⇄ 按鈕（React Flow `NodeToolbar`）；右鍵節點選單「翻轉輸入／輸出」；命令面板「翻轉選取節點的輸入／輸出」；快捷鍵 `F`（作用於所有選取節點，至少一個）。
- 翻轉後必須呼叫 `updateNodeInternals` 讓連線端點重算。

**互動**
- 一鍵排版、切換橫／直式**保留**翻轉。
- Tab 建下游節點：若錨點已翻轉，放在流向的反側（LR 放左邊、TB 放上方）。
- 同層（Enter）位置不受翻轉影響。

**資料**
- `CausalNodeData.flipped?: boolean`。
- JSON `nodes[].flipped`：選填 boolean；只在 true 時輸出。

## 3. 移除雙向連線

因果圖只有單向因果。

- UI 全部移除：工具列「新連線預設」的單向／雙向、Inspector「改單向／改雙向」、右鍵「切換單／雙向」、快捷鍵 `B`、快捷鍵一覽與 README 對應列。
- `CausalEdgeData` 移除 `bidirectional`；連線只有 `markerEnd`。store 移除 `defaultBidirectional`／`setDefaultBidirectional`。
- JSON 向後相容：
  - 讀取：`direction` 改為選填；`"one-way"` 或 `"bidirectional"` 都接受，一律當單向；其他值仍報錯。
  - 寫出：固定輸出 `"direction": "one-way"`（舊版 app 讀得到）。
  - `CausalDirection` 型別收斂為 `"one-way"`。
- `IMPORT_JSON.md`、app 內 AI 指南（`CAUSAL_JSON_AI_GUIDE`）同步：direction 標為選填、只有 one-way；新增 bend、flipped 說明。
- 範例圖（`lib/sample-causal.ts`）中的雙向邊改為單向。

## 測試

- `lib/edge-geometry.ts` 純函式：控制點、二次曲線控制點、路徑字串、預設中點；單元測試。
- `parseCausalJson`：bend 驗證（非數字報錯）、flipped 驗證（非 boolean 報錯）、direction 缺省／bidirectional 皆成單向、round-trip。
- store：`setEdgeBend` 不 commit、`resetEdgeBend` commit、`applyLayout` 清 bend 但保留 flipped、`toggleFlip` commit 且可 undo。
- placement：翻轉錨點的下游位置。
- UI 驗收（ego-browser）：拖控制點、雙擊重設、undo、拖節點時曲線跟隨、排版清彎曲、翻轉按鈕／F／右鍵、翻轉後 Tab、雙向 UI 已消失、匯入含 bidirectional 的 JSON 成功。

## 不做

- 多個轉折點、直角折線。
- 翻轉時自動交換既有連線的方向（連線語意不變，只換接點位置）。
