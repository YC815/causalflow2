# CausalFlow 易用性大改：存檔、Undo、畫布直接操作、鍵盤流

日期：2026-10-01
範圍：本輪只做三塊——(1) 自動存檔＋Undo/Redo、(2) 畫布直接操作、(3) 鍵盤流。多文件管理留待下一輪，但存檔格式不得阻礙它。

## 動機

- 重新整理即遺失全部內容。
- 無 undo，誤刪不可救。
- 改節點文字、改連線極性都要繞到右上工具面板。
- 新增節點固定落在畫面中央，需手動拉線。
- 無快捷鍵、複製貼上、搜尋。
- `components/causal/causal-flow-app.tsx` 已 1000+ 行，無法再承載新功能。

## 架構

新增依賴：`zustand`、shadcn/ui（`context-menu`、`command`、`dialog` 及其 Radix／cmdk 依賴）、`vitest`（dev）。

```
lib/store/causal-store.ts      zustand store：nodes, edges, title, layoutDirection,
                               defaultPolarity, defaultBidirectional, 所有 mutation action
lib/store/history.ts           snapshot 堆疊（純函式），上限 100
lib/store/persistence.ts       localStorage 讀寫
lib/placement.ts               Tab/Enter 新節點位置、重疊推移（純函式）
lib/clipboard.ts               選取 → 片段、片段 → 新 id 貼上（純函式）
lib/navigation.ts              方向鍵找最近節點（純函式）
components/causal/
  causal-flow-app.tsx          組裝＋ReactFlow 畫布事件
  toolbar.tsx                  左上標題區＋右上工具面板
  inspector.tsx                選中節點／連線屬性區
  canvas-context-menu.tsx      單一右鍵選單，依右鍵目標（節點／連線／空白／多選）切換內容
  command-palette.tsx          Ctrl/⌘+K
  shortcuts-dialog.tsx         ?
  json-editor-dialog.tsx       由現有 JSON 編輯器搬出
  use-autosave.ts              啟動載入＋debounce 存檔
  use-causal-commands.ts       所有使用者動作（工具列、快捷鍵、右鍵、命令面板共用）
  use-hotkeys.ts               全域快捷鍵＋copy/cut/paste 事件
```

store 是 nodes/edges/title 的唯一來源；ReactFlow 以 controlled 模式接 store（`onNodesChange`／`onEdgesChange` 呼叫 store 的 `applyNodeChanges`／`applyEdgeChanges`）。selection 仍由 React Flow 的 `selected` 欄位承載，但不進歷史、不進存檔。

## Undo / Redo

- 快照內容：`{ nodes, edges, title, layoutDirection }`（selected/dragging 一律清為 false）。不含 viewport。layoutDirection 必須在快照內，否則 undo「切橫直」會還原座標卻留著錯的 handle 方向。
- store 提供 `commit()`：把「變更前」快照推入 past，清空 future。所有會改文件的 action 在變更前呼叫一次 `commit()`。
- 記錄時機：
  - 拖曳：`onNodeDragStart`／`onSelectionDragStart` 時 commit 一次（拖曳過程不記）。
  - 刪除（Delete／Backspace）：沿用 React Flow 內建刪除鍵，於 `onBeforeDelete` 中 commit。
  - 節點 inline 編輯：進入編輯時 commit；確認時若文字未變或取消，丟棄該筆 commit。
  - inspector textarea、標題：同一次 focus 期間第一次變更時 commit 一次。
  - 新增、刪除、連線、改極性／方向、反轉、貼上、剪下、複製、一鍵排版、切橫直、匯入 JSON、套用 JSON 編輯器、新空白圖：各 commit 一次。
  - 匯出 PDF 的暫時重排：不 commit，維持現有 restore 邏輯。
- 上限 100 筆，超過丟最舊的。
- undo 後做任何新 commit，future 清空。

## 持久化

- key：`causalflow-doc-v1`，值為現有 CausalFlow JSON（`flowToDocument` 輸出，`stringifyCausalJson` 格式）。與匯出檔同格式。
- 另存 `causalflow-layout-v1`：`"LR" | "TB"`。
- store 變動 → debounce 500ms 寫入。
- 啟動：讀 key → `parseCausalJson` → 成功則載入；不存在則載入 `SAMPLE_CAUSAL_DOCUMENT`；解析失敗則把原字串存到 `causalflow-doc-v1-corrupt`、載入範例、toast「存檔損毀，已載入範例（原資料已備份）」。
- 寫入失敗（quota、隱私模式）：toast 一次「無法自動存檔」，之後同 session 不再重複 toast，不阻擋操作。
- 載入在 client 端 mount 後進行（避免 SSR hydration 不一致）。
- 工具列新增「新空白圖」：直接 commit 並清空 nodes/edges/title，toast「已清空，可按 ⌘/Ctrl+Z 復原」。不用 `confirm`（可 undo，且 confirm 會卡住瀏覽器自動化）。

## 畫布直接操作

| 動作 | 行為 |
|---|---|
| 雙擊節點 | 原地 textarea 編輯。`Enter` 確認、`Shift+Enter` 換行、`Esc` 取消並還原、blur 確認 |
| 雙擊空白 | 在游標處建節點並進入編輯 |
| 從 handle 拖線放到空白 | 在放開處建節點＋連線（預設極性／方向），進入編輯 |
| 選中連線按 `+` `=` / `-` / `0` | 正／負／未指定 |
| 選中連線按 `B` | 切單／雙向 |
| 右鍵節點 | 編輯文字、建下游節點、複製、刪除 |
| 右鍵連線 | 正、負、未指定、單／雙向、反轉方向、刪除 |
| 右鍵空白 | 在此新增節點、貼上、一鍵排版、全選 |
| Shift+拖曳 | 框選；多選可一起拖、一起刪 |

- 新增 `MiniMap`（左下、Controls 右側；右下已被「JSON／AI 指南」佔用）。以 Controls 內的按鈕切換顯示，狀態存 localStorage。
- 新建節點一律以 label「新節點」建立並進入編輯（文字全選，直接打字即覆蓋），存檔中永遠不會出現空 label。
- 編輯確認時 label trim 後為空：若是本次新建的節點則刪除該節點（及其連線），並丟棄建立時那筆 commit（等同取消新建，past 堆疊 pop 一次）；若是既有節點則還原舊值。
- 反轉方向：交換 source/target；若反轉後與既有連線重複則 toast「兩節點之間已有連線」並不動作。

## 鍵盤流

| 鍵 | 行為 |
|---|---|
| `Tab` | 建下游節點：放在選中節點流向方向（LR 在右、TB 在下），連 選中→新，進入編輯 |
| `Enter` | 建同層節點：取選中節點的第一個上游（edges 中 target 為它的第一條），連 上游→新，放在選中節點旁（LR 在下、TB 在右）；無上游則建獨立節點放同位置 |
| `F2` / `Space` | 編輯選中節點 |
| 方向鍵 | 移動選取到該方向最近節點 |
| `Delete` / `Backspace` | 刪除選取 |
| `⌘/Ctrl+Z` | undo |
| `⌘/Ctrl+Shift+Z`、`Ctrl+Y` | redo |
| `⌘/Ctrl+C` / `V` / `X` | 複製／貼上／剪下 |
| `⌘/Ctrl+D` | 原地複製（偏移 +24px） |
| `⌘/Ctrl+A` | 全選 |
| `⌘/Ctrl+K` | 命令面板 |
| `⌘/Ctrl+L` | 一鍵排版 |
| `?` | 快捷鍵一覽 |
| `Esc` | 取消選取／關閉對話框 |

規則：
- 焦點在 `input`、`textarea`、`select`、`button`、連結、`[contenteditable]`、對話框或選單內時，不攔截任何全域快捷鍵（`Esc` 由該元件自己處理）。
- Tab／Enter／F2／Space 只在恰好選中一個節點時作用；多選或無選取時不動作（Tab 也不攔截，保留瀏覽器焦點移動）。
- 方向鍵：只在恰好選中一個節點時作用。候選為中心點位於該方向半平面、且與該方向夾角 ≤ 60° 的節點，取歐氏距離最小者；無候選則不動。移動後若節點不在視窗內，平移視窗使其可見。
- 新節點位置（placement）：基準點 = 選中節點位置 + 流向偏移（LR：x + 寬 + 80；TB：y + 高 + 80；同層則在垂直流向上 + 高/寬 + 40）。若與任一既有節點 bounding box 重疊，沿同層方向每次推 40px 直到不重疊（上限 50 次）。節點尺寸取 React Flow 量測值，未量測則用 160×60。

### 剪貼簿

- 複製內容：選取節點＋兩端皆在選取內的連線。另可只選連線——此時不複製（無意義）。
- 鍵盤複製／剪下／貼上走 document 的 `copy`／`cut`／`paste` 事件（`clipboardData`），不用 `navigator.clipboard.readText()`——後者會跳權限詢問。
- 複製：寫入內部剪貼簿（記憶體），並以 `clipboardData.setData("text/plain", CausalFlow JSON)` 寫入系統剪貼簿，可跨分頁貼。
- 貼上：`clipboardData` 文字能被 `parseCausalJson` 解析則用它，否則用內部剪貼簿；兩者皆無則不動作。
- 右鍵選單的「複製」寫內部剪貼簿並 best-effort `navigator.clipboard.writeText`；「貼上」只用內部剪貼簿。
- 貼上時所有節點與連線產生新 id（節點 `n-<seed>-<i>`、連線 `e-<src>-<tgt>-<i>`，seed 每次貼上唯一），位置 +24px；若由右鍵空白「貼上」則以點擊位置為片段左上角。貼上後選取新貼入的節點。
- 剪下 = 複製 + 刪除，一次 commit。

### 命令面板

- shadcn `CommandDialog`。兩組：
  - 動作：新增節點、一鍵排版、切橫／直式、undo、redo、匯入 JSON、匯出 JSON、編輯 JSON、匯出 PNG、匯出 PDF 直／橫、新空白圖、快捷鍵一覽。
  - 節點：列出所有節點 label，可模糊搜尋；選擇後選取該節點並 `fitView` 到它。

## 錯誤處理

- 壞存檔：見持久化。
- 剪貼簿內容非法：忽略，改用內部剪貼簿。
- 重複連線：沿用 toast「兩節點之間已有連線」。拖線到空白建節點不會觸發。

## 測試

- 加 `vitest`，`package.json` 加 `"test": "vitest run --passWithNoTests"`。
  - 另測 `causal-store`：新增＋undo／redo、取消新建節點、重複連線、反轉、刪除連帶連線、貼上、排版 undo 還原方向。
- 單元測試（純邏輯）：
  - `history`：commit／undo／redo、上限 100 截斷、undo 後 commit 清空 future。
  - `persistence`：round-trip、壞資料備份並 fallback、不存在時 fallback。
  - `placement`：Tab／Enter 在 LR／TB 的位置、重疊推移。
  - `clipboard`：只帶內部連線、貼上新 id 不衝突、位置偏移。
  - `navigation`：四方向最近節點、夾角篩選、無候選。
- 驗證：`pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm test`、`pnpm build`。
- UI 驗收：背景啟動 dev server，以 ego-browser 實際操作每一列表格中的互動並確認行為；結束後關閉 dev server。

## 不做（本輪）

- 多文件管理（側邊欄文件列表）。
- 節點樣式（顏色、大小）、註解、群組。
- 協作、雲端同步。
- 觸控裝置的雙擊／長按最佳化。
