# 多檔案＋側邊欄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 可以開多個檔案（多張獨立因果圖），檔案列在左側側邊欄，可切換、新增、重新命名、建立副本、刪除；另修正新節點編輯框拿不到焦點的 bug。

**Architecture:** 純函式 `lib/store/files.ts` 管理 localStorage 的檔案索引與各檔內容（注入 storage，可測）；zustand `lib/store/files-store.ts` 管理檔案清單與目前檔案，切換時把文件載入既有的 `useCausalStore` 並清空 undo；autosave 寫入目前檔案並更新索引。側邊欄取代左上角標題卡。

**Tech Stack:** Next.js 16 / React 19 / @xyflow/react 12.10 / zustand 5 / shadcn (radix) / vitest / pnpm

## 設計（已與使用者確認）

- 側邊欄（左、可收合）：檔案清單依最後修改時間新→舊；每列顯示檔名（空白顯示「未命名」）與最後修改時間；頂部「＋ 新檔案」；點擊切換；每列「⋯」選單：重新命名、建立副本、刪除（刪除前確認框）。
- 檔名＝圖的 `title`。
- 每檔各自自動存檔、各自記住橫直式。切換檔案時 undo 歷史清空。
- 「匯入 JSON 檔」（檔案選擇器、命令面板「匯入 JSON」）→ 建立新檔案並切換過去。JSON 編輯器「套用變更」仍改目前檔案（可 undo）。
- 工具列「新空白圖」改為「新檔案」；不再需要清空確認框。
- 刪掉最後一個檔案 → 自動建立空白檔案。
- 首次開啟：既有單一存檔（`causalflow-doc-v1`）遷移成第一個檔案；舊 key 不刪。
- 命令面板新增「檔案」群組可切換檔案、動作「新檔案」。

## Global Constraints

- pnpm only；不得前景跑 dev／watch。每個 task 結束前 `pnpm exec tsc --noEmit && pnpm lint && pnpm test` 全過才 commit（UI task 加 `pnpm build`）；不得 eslint-disable。
- **每個 task 結束時 app 必須能正常運作**（使用者開著熱重載 dev server 在用）。不得留下壞掉的中間狀態。
- UI 文字繁中；註解繁中精簡。
- localStorage keys：索引 `causalflow-files-v1`（JSON：`FileMeta[]`）、目前檔案 `causalflow-active-file-v1`、檔案內容 `causalflow-file-v1:<id>`、檔案版面 `causalflow-file-layout-v1:<id>`。舊 key `causalflow-doc-v1`／`causalflow-layout-v1` 只讀不刪不寫。
- 檔案內容格式即現有 CausalFlow JSON（`stringifyCausalJson`）。
- 開啟檔案本身不得改變其 `updatedAt`（內容沒變就不寫入）。

---

### Task 1: 新節點編輯框焦點修正

**Files:** Modify `components/causal/causal-node.tsx`, `components/causal/use-hotkeys.ts`

問題：新節點在 React Flow 量測完成前是 `visibility:hidden`，`NodeLabelEditor` 以 setTimeout 重試 focus；在這段期間按鍵打到 body，Enter 會被當成「建同層節點」而多建節點，文字遺失。

- [ ] **Step 1:** `CausalNode` 從 `NodeProps` 取 `width`（React Flow 12 傳入的是量測後尺寸，未量測為 0／undefined），傳 `ready={(width ?? 0) > 0}` 給 `NodeLabelEditor`。
- [ ] **Step 2:** `NodeLabelEditor` 移除 setTimeout 重試迴圈，改為：
  ```ts
  useLayoutEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, [ready]);
  ```
- [ ] **Step 3:** `use-hotkeys.ts` 的 `onKeyDown`：在既有的 exporting／composing／isOwnedByOtherUi 早退之後加 `if (useCausalStore.getState().editing) return;`（有節點正在／即將進入編輯時，所有全域快捷鍵不作用）。copy／cut／paste 事件同樣加此判斷。
- [ ] **Step 4:** 驗證後 commit：`fix(causal): focus new node editor once measured; block hotkeys while editing`。

---

### Task 2: 檔案儲存純函式

**Files:** Create `lib/store/files.ts`, `lib/store/files.test.ts`

**Interfaces（Produces）:**
```ts
export type FileStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type FileMeta = { id: string; title: string; updatedAt: number };
export const INDEX_KEY = "causalflow-files-v1";
export const ACTIVE_KEY = "causalflow-active-file-v1";
export const fileDocKey = (id: string) => `causalflow-file-v1:${id}`;
export const fileLayoutKey = (id: string) => `causalflow-file-layout-v1:${id}`;
export const UNTITLED = "未命名";
export function displayTitle(title: string): string; // trim 後空白 → UNTITLED
export function sortByRecent(files: FileMeta[]): FileMeta[]; // updatedAt 降序，不改原陣列
export function loadIndex(storage: FileStorage): FileMeta[]; // 缺或壞 → []；過濾掉欄位型別不對的項目
export function saveIndex(storage: FileStorage, files: FileMeta[]): boolean;
export function readFileDoc(storage: FileStorage, id: string): CausalJsonDocument | null; // 缺或解析失敗 → null（解析失敗時把原字串備份到 `${fileDocKey(id)}-corrupt`）
export function writeFileDoc(storage: FileStorage, id: string, doc: CausalJsonDocument): boolean;
export function readFileLayout(storage: FileStorage, id: string): CausalLayoutDirection; // 預設 "LR"
export function writeFileLayout(storage: FileStorage, id: string, dir: CausalLayoutDirection): void;
export function removeFile(storage: FileStorage, id: string): void; // 移除 doc 與 layout key
export function bootstrapFiles(
  storage: FileStorage,
  opts: { sample: CausalJsonDocument; now: number; newId: () => string },
): { files: FileMeta[]; activeId: string; migrated: boolean };
```
`bootstrapFiles` 規則：
1. 索引非空 → 不建立任何東西；activeId = `ACTIVE_KEY` 的值若存在於索引，否則 `sortByRecent(files)[0].id`；`migrated: false`。
2. 索引為空 → 用既有 `loadStoredDocument(storage, opts.sample)` 讀舊 key（status `loaded` 時 `migrated: true`）與 `loadStoredLayout`；建立一個檔案（id = `opts.newId()`、title = `doc.title ?? ""`、updatedAt = `opts.now`），寫入 doc、layout、索引、ACTIVE_KEY。舊 key 不刪。
所有寫入失敗都不丟例外。

- [ ] **Step 1: 測試（先失敗）** `lib/store/files.test.ts`，用 Map 實作的 MemoryStorage（含 removeItem）與一個 throwing storage，至少涵蓋：
  - displayTitle：`"  "` → `未命名`；`"A"` → `"A"`。
  - sortByRecent 降序且不改原陣列。
  - loadIndex：缺 key → []；壞 JSON → []；含不合法項目（缺 id 或 updatedAt 非數字）時被過濾。
  - writeFileDoc / readFileDoc round-trip；壞內容 → null 且備份到 `-corrupt` key。
  - read/writeFileLayout 預設 LR、可存 TB。
  - removeFile 移除兩個 key。
  - bootstrapFiles：空 storage → 用 sample 建一檔、`migrated:false`、ACTIVE_KEY 被寫入；舊 key 有合法文件 → 遷移成檔案（title 沿用）、`migrated:true`、舊 key 仍在；舊 layout 為 TB → 新檔 layout 為 TB；索引已存在 → 不新增檔案、activeId 優先用 ACTIVE_KEY、ACTIVE_KEY 指向不存在 id 時用最近的檔案。
  - throwing storage：所有函式不丟例外（bootstrap 仍回傳一個檔案）。
- [ ] **Step 2:** 實作（重用 `lib/store/persistence.ts` 的 `loadStoredDocument`、`loadStoredLayout`，以及 `parseCausalJson`／`stringifyCausalJson`）。
- [ ] **Step 3:** 驗證後 commit：`feat(store): file index and per-file storage`。

---

### Task 3: 檔案狀態與自動存檔接線（UI 仍用既有標題卡）

**Files:**
- Create `lib/store/files-store.ts`, `lib/store/files-store.test.ts`
- Modify `lib/store/causal-store.ts`（新增 `loadDocument`）, `components/causal/use-autosave.ts`, `components/causal/use-causal-commands.ts`, `components/causal/causal-flow-app.tsx`, `components/causal/toolbar.tsx`
- Delete `components/causal/new-blank-dialog.tsx`（不再使用）

**Interfaces:**
- causal-store：`loadDocument(doc: CausalJsonDocument, layoutDirection: CausalLayoutDirection): void` — 等同 `replaceDocument` 並把 `history` 重設為空、`editing`／`editingSavedFuture` 清空、所有節點與連線取消選取。不 commit。
- files-store（zustand）：
  ```ts
  type FilesState = {
    files: FileMeta[];           // 未排序；UI 自行 sortByRecent
    activeId: string | null;
    init(storage: FileStorage, opts?: { now?: () => number; newId?: () => string }): void; // bootstrap 並把 active 檔載入 causal store
    openFile(id: string): void;  // 先把目前 causal 狀態存回目前檔案（內容有變才寫並更新 updatedAt），再讀目標檔案 → causal.loadDocument → 設 activeId 與 ACTIVE_KEY
    createFile(doc?: CausalJsonDocument): string; // 預設空白文件；寫入、加入索引、openFile；回傳 id
    renameFile(id: string, title: string): void;  // active 檔：causal.setTitle（存檔流程會同步索引）；非 active：改寫該檔 doc.title 與索引 title／updatedAt
    duplicateFile(id: string): string;            // 複製內容與 layout，title 加「（副本）」，openFile 到副本
    deleteFile(id: string): void;                 // removeFile＋移出索引；若刪的是 active → 開最近的剩餘檔；沒有剩餘 → createFile()
    saveActive(): void;          // 把 causal 目前狀態寫入 active 檔；序列化結果與上次寫入相同就跳過；否則寫 doc、layout，更新索引 title 與 updatedAt
  };
  ```
  `init` 之後 storage 保存在 store 內部（模組變數或 state 欄位皆可），其餘 action 使用它。`now` 預設 `Date.now`、`newId` 預設 `f-${uid()}`（uid 來自 causal-store）。
- autosave：`hydrateFromStorage()` 改為呼叫 `useFilesStore.getState().init(browserStorage())`，若 bootstrap 讀到損毀舊存檔沿用既有 toast；`useAutosave` 的 debounce／pagehide／exporting 邏輯保留，但實際寫入改呼叫 `useFilesStore.getState().saveActive()`；寫入失敗仍只 toast 一次「無法自動存檔」（saveActive 回傳 boolean 讓 hook 判斷）。
- commands：新增 `importAsNewFile(text: string): string | null` — 解析成功則 `createFile(doc)` 並 toast「已匯入為新檔案」，回傳 null；失敗回傳錯誤訊息。`importText` 保留（JSON 編輯器用）。`newBlank` 移除，改 `newFile: () => useFilesStore.getState().createFile()`。
- app：檔案選擇器 `onFile` 改用 `importAsNewFile`；命令面板「匯入 JSON」不變（仍開檔案選擇器）；命令面板「新空白圖」改為 `{ id: "new-file", label: "新檔案", run: commands.newFile }`；移除 `blankConfirmOpen` 與 `NewBlankDialog`；Toolbar 的 `onNewBlank` prop 改名 `onNewFile`，按鈕文字「新檔案」。

- [ ] **Step 1: files-store 測試（先失敗）** `lib/store/files-store.test.ts`：每個測試前重設兩個 store（`setState(getInitialState(), true)`），用 MemoryStorage 與遞增的 fake `now`／`newId`。至少涵蓋：
  - init 空 storage → 1 檔、activeId 為該檔、causal store 載入 sample。
  - createFile → 2 檔、active 為新檔、causal 空白、undo 歷史為空。
  - 在檔 A 新增節點 → openFile(B) → openFile(A) → 節點還在；A 的 updatedAt 有更新；B 只被開啟未修改 → updatedAt 不變。
  - openFile 後 `history.past.length === 0`。
  - renameFile(active) → causal title 改變、saveActive 後索引 title 同步；renameFile(非 active) → 索引與該檔 doc.title 改變、active 檔不受影響。
  - duplicateFile → 新檔內容相同、title 含「（副本）」、active 為副本。
  - deleteFile(active) 有其他檔 → active 切到最近的剩餘檔；deleteFile 最後一檔 → 自動建立新空白檔；被刪檔的 storage key 已移除。
  - saveActive 內容未變 → 不寫入（updatedAt 不變）。
- [ ] **Step 2:** 實作 causal-store `loadDocument`（含一個 store 測試：load 後 history 為空、無選取）。
- [ ] **Step 3:** 實作 files-store、autosave、commands、app、toolbar 改動。刪除 `new-blank-dialog.tsx` 及其引用。
- [ ] **Step 4:** `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`；commit：`feat(causal): multiple files with per-file autosave; import opens a new file`。

---

### Task 4: 檔案側邊欄 UI

**Files:**
- Create `components/causal/file-sidebar.tsx`, `components/causal/confirm-dialog.tsx`
- Add shadcn: `pnpm dlx shadcn@latest add dropdown-menu -y`（若 CLI 想改 globals.css／layout.tsx，還原那些改動，只保留 `components/ui/dropdown-menu.tsx` 與必要依賴）
- Modify `components/causal/toolbar.tsx`（移除 `TitleCard`，左側改放 `FileSidebar`）, `components/causal/causal-flow-app.tsx`（命令面板檔案群組）, `components/causal/command-palette.tsx`, `README.md`

**規格:**
- `FileSidebar`：
  - 收合狀態（`useStoredFlag("causalflow-ui-sidebar-collapsed", false)`）：左上角一顆圓角按鈕，lucide `PanelLeftOpen` 圖示＋目前檔名（`displayTitle`，截斷）。
  - 展開狀態：固定在左側（`absolute left-3 top-3 bottom-3`，寬 `w-64`，沿用 toolbar 的 `cardClass` 紙色卡片樣式），內容由上而下：
    1. 標頭：「CausalFlow」字樣（`causal-display`）＋收合按鈕（`PanelLeftClose`）。
    2. 目前檔名輸入框（沿用原 TitleCard 的 commit-on-first-change 邏輯，改 `setTitle`）。
    3. 「＋ 新檔案」按鈕（`shellBtnPrimary`），呼叫 `createFile()`。
    4. 可捲動清單：`sortByRecent(files)`；每列顯示 `displayTitle(title)` 與時間（`new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updatedAt)`）；active 列以 `bg-[var(--causal-accent-muted)]` 標示；點列 → `openFile(id)`（點 active 列不動作）。
    5. 每列右側「⋯」（lucide `MoreHorizontal`）開 `DropdownMenu`：「重新命名」（把該列變成 inline input，Enter／blur 確認、Esc 取消，呼叫 `renameFile`）、「建立副本」（`duplicateFile`）、「刪除」（destructive，開 `ConfirmDialog`）。
  - 所有按鈕／列加 `nodrag nopan`；側邊欄根元素 `role="navigation"`、`aria-label="檔案"`。
- `ConfirmDialog`（shadcn Dialog）：props `open, onOpenChange, title, description, confirmLabel, onConfirm`；確認按鈕 destructive。刪除文案：標題「刪除『{檔名}』？」、說明「刪除後無法復原。」、按鈕「刪除」。
- 側邊欄聚焦時全域快捷鍵不得作用：`use-hotkeys.ts` 的 `isOwnedByOtherUi` 選擇器加 `[role="navigation"]`。
- 命令面板：新增「檔案」群組列出所有檔案（`value={file.id}`、`keywords={[displayTitle(file.title)]}`），選擇 → `openFile`；動作群組已有「新檔案」。
- README 操作表新增「多個檔案｜左側側邊欄：新檔案、切換、⋯ 選單重新命名／建立副本／刪除；匯入 JSON 會建立新檔案」。

- [ ] **Step 1:** 加 dropdown-menu 元件並確認 `git diff app/` 為空。
- [ ] **Step 2:** 實作 `confirm-dialog.tsx`、`file-sidebar.tsx`。
- [ ] **Step 3:** toolbar 移除 `TitleCard`（及其 `LS_LEFT` 等只給它用的程式碼），左側改 render `<FileSidebar />`。
- [ ] **Step 4:** 命令面板檔案群組、hotkeys 選擇器、README。
- [ ] **Step 5:** `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`；commit：`feat(causal): file sidebar with rename, duplicate, delete`。

---

### Task 5: UI 驗收

由 controller 以 ego-browser 進行：遷移既有存檔成第一個檔案、新檔案、切換保留內容、切換不改 updatedAt、undo 不跨檔、重新命名（active 與非 active）、副本、刪除（含最後一檔）、匯入 JSON 建新檔、JSON 編輯器套用仍改目前檔、重新整理後回到上次開的檔案、Tab 後立即打字不再多建節點。
