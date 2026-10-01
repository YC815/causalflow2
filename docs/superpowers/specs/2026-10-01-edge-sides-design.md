# 單條連線選擇接點側

日期：2026-10-01
分支：接在 `feat/usability-overhaul` 上。

## 目標

每條連線的兩端可各自選擇接在節點的「輸入側」或「輸出側」，不必翻轉整個節點。因果方向不變：source 永遠是因、target 永遠是果，箭頭在 target 端。

## 接點

- 每個節點兩側各一個 Handle，id 為 `"in"`（輸入側）與 `"out"`（輸出側），**兩者 type 皆為 `"source"`**，React Flow 使用 `connectionMode={ConnectionMode.Loose}`。如此從任一接點拉線，拖曳起點的節點永遠是 source（React Flow 只在起點 handle type 為 target 時才對調）。
- 位置：`in` 在輸入側（橫式左／直式上），`out` 在輸出側；節點 `flipped` 時兩者互換（沿用既有翻轉邏輯）。
- 每條 flow edge 一律帶明確的 `sourceHandle`、`targetHandle`（預設 `"out"`／`"in"`）。loose 模式下沒有 handle id 會落到第一個 handle，必須避免。

## 操作

- **新連線**：起點 handle、放開處 handle 決定兩端側別（`onConnect` 的 `sourceHandle`／`targetHandle`）。
- **拖線頭改接**：`edgesReconnectable` + `onReconnect`。可拖到同節點另一側，或改接到其他節點。改接後若與其他連線重複（同 source→target）或成為自環，擋下並 toast。拖線頭放到空白處：不動作（不得觸發「拖到空白建節點」）。
- **右鍵連線**：「起點改接另一側」「終點改接另一側」。
- **拖到空白建節點**：沿用既有行為；新連線的 source 端用拖曳起點的 handle id，target 端用新節點的 `"in"`。
- **反轉方向**：交換 source／target，兩端側別重設為預設。
- 以上皆一步 undo。
- 自環（source === target）一律拒絕，toast「不能連到自己」。

## 資料

- `type HandleSide = "in" | "out"`。
- JSON `edges[]` 新增選填 `sourceSide`、`targetSide`（值 `"in"`／`"out"`）；只在非預設時輸出（`sourceSide: "in"`、`targetSide: "out"`）。其他值報錯。舊檔不受影響。
- `IMPORT_JSON.md`、AI 指南同步。

## 測試

- JSON：sides 讀寫、預設省略、非法值報錯。
- store：connect 帶 handle、自環拒絕、reconnect（排除自身的重複檢查、自環拒絕、commit 可 undo）、toggleEdgeSide、reverse 重設側別。
- UI 驗收（ego-browser）。

## 不做

- 節點上下（橫式）或左右（直式）第三、第四側的接點。
