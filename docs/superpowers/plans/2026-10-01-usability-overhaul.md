# CausalFlow 易用性大改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 CausalFlow 具備自動存檔、Undo/Redo、畫布上直接編輯／建節點、XMind 式鍵盤流、右鍵選單與命令面板。

**Architecture:** 以 zustand store（`lib/store/causal-store.ts`）作為 nodes/edges/title/layoutDirection 的唯一來源，React Flow 以 controlled 模式接上；undo 用 snapshot 堆疊。所有使用者動作集中在 `useCausalCommands`，由工具列、快捷鍵、右鍵選單、命令面板共用。純邏輯（history、persistence、placement、navigation、clipboard）各自獨立成檔並以 vitest 測試。

**Tech Stack:** Next.js 16.2 / React 19.2 / @xyflow/react 12.10 / zustand 5 / shadcn/ui（radix base, nova preset）/ vitest / pnpm 11

**Spec:** `docs/superpowers/specs/2026-10-01-usability-overhaul-design.md`

## Global Constraints

- 套件管理一律 `pnpm`（`pnpm add`、`pnpm dlx`）。不得使用 npm/yarn/bun。
- 不得在前景執行 `pnpm dev` 或任何 watch 指令；`pnpm test` 對應的是 `vitest run`（會結束）。
- 每個 task 結束前必跑：`pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm test`，全部通過才 commit。
- 本專案 Next.js 有破壞性變更：動到 Next API 前先讀 `node_modules/next/dist/docs/`。本計畫不新增任何 Next API 使用。
- UI 文字一律繁體中文；程式碼註解沿用現有風格（繁中、精簡）。
- 存檔 key：`causalflow-doc-v1`、`causalflow-doc-v1-corrupt`、`causalflow-layout-v1`。
- 新節點預設 label：`新節點`。重複連線 toast：`兩節點之間已有連線`。
- 歷史上限：100。存檔 debounce：500ms。貼上偏移：24px。
- placement 常數：預設節點尺寸 160×60、流向間距 80、同層間距 40、推移步長 40、推移上限 50 次。
- 方向鍵鄰居夾角上限 60°（含）。
- commit message 結尾加：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

## File Structure

```
lib/store/history.ts                 純函式 snapshot 堆疊
lib/store/persistence.ts             localStorage 讀寫（注入 StorageLike）
lib/store/causal-store.ts            zustand store
lib/placement.ts                     新節點位置
lib/navigation.ts                    方向鍵鄰居
lib/clipboard.ts                     片段擷取／實例化
lib/**/*.test.ts                     vitest
components/ui/*                      shadcn 產生（不手改）
components/causal/
  causal-flow-app.tsx                組裝＋ReactFlow 事件（重寫）
  causal-node.tsx                    加 inline 編輯（修改）
  toolbar.tsx                        標題卡＋工具面板（新）
  inspector.tsx                      選中屬性（新）
  json-editor-dialog.tsx             JSON 編輯器（新，由舊檔搬出）
  ui-classes.ts                      共用 class／極性選項／修飾鍵標籤（新）
  use-stored-flag.ts                 localStorage 布林旗標 hook（新）
  use-autosave.ts                    hydrate＋自動存檔（新）
  use-causal-commands.ts             所有使用者動作（新）
  use-hotkeys.ts                     快捷鍵＋copy/cut/paste（新）
  canvas-context-menu.tsx            右鍵選單（新）
  command-palette.tsx                命令面板（新）
  shortcuts-dialog.tsx               快捷鍵一覽（新）
```

---

### Task 1: 工具鏈（shadcn、zustand、vitest）

**Files:**
- Create: `components.json`, `components/ui/*`, `lib/utils.ts`, `vitest.config.mts`（由 CLI 產生或手寫）
- Modify: `app/globals.css`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`（若需要）
- Revert: `app/layout.tsx`（shadcn init 會改它，必須還原）

**Interfaces:**
- Produces: `@/components/ui/context-menu`、`@/components/ui/command`、`@/components/ui/dialog`、`@/components/ui/kbd`；`zustand`；`pnpm test` 指令。

- [ ] **Step 1: shadcn init（radix base）**

```bash
pnpm dlx shadcn@latest init -t next -b radix -p nova -y --no-monorepo
```

Expected：建立 `components.json`、`components/ui/button.tsx`、`lib/utils.ts`，修改 `app/globals.css`、`app/layout.tsx`、`package.json`。

- [ ] **Step 2: 還原 layout.tsx**

shadcn 會把字型換成 Geist，蓋掉 IBM Plex。直接還原：

```bash
git checkout app/layout.tsx
```

- [ ] **Step 3: 修正 globals.css 的字型 token**

在 `app/globals.css` 的 `@theme inline { ... }` 區塊中，把：

```css
  --font-sans: var(--font-sans);
  --font-heading: var(--font-sans);
```

改為：

```css
  --font-sans: var(--font-causal-ui);
  --font-heading: var(--font-causal-ui);
```

- [ ] **Step 4: 把 shadcn token 對應到 causal 色票**

在 `app/globals.css` 第一個 `:root { ... }` 區塊中，將 shadcn 加入的下列行（原值為 `oklch(...)`）逐行替換為：

```css
  --background: var(--causal-paper);
  --foreground: var(--causal-ink);
  --card: var(--causal-paper);
  --card-foreground: var(--causal-ink);
  --popover: var(--causal-paper);
  --popover-foreground: var(--causal-ink);
  --primary: var(--causal-accent);
  --primary-foreground: #ffffff;
  --secondary: var(--causal-paper-2);
  --secondary-foreground: var(--causal-ink);
  --muted: var(--causal-paper-2);
  --muted-foreground: var(--causal-ink-muted);
  --accent: var(--causal-paper-2);
  --accent-foreground: var(--causal-ink);
  --border: var(--causal-node-border);
  --input: var(--causal-node-border);
  --ring: var(--causal-accent);
```

其餘 shadcn 變數（`--destructive`、`--chart-*`、`--radius`、`--sidebar-*`）與 `.dark` 區塊保持不動。原本的 `body { ... }` 規則（未分層）不要動——它優先於 shadcn 在 `@layer base` 裡的 `body` 規則，畫布背景因此維持不變。

- [ ] **Step 5: 加入 shadcn 元件**

```bash
pnpm dlx shadcn@latest add context-menu command dialog kbd -y
```

Expected：新增 `components/ui/{context-menu,command,dialog,kbd,input,input-group,textarea}.tsx`（button 已存在會略過）。

- [ ] **Step 6: 加 zustand 與 vitest**

```bash
pnpm add zustand
pnpm add -D vitest vite-tsconfig-paths
```

若 pnpm 回報 `ERR_PNPM_IGNORED_BUILDS` 且列出 `esbuild`，在 `pnpm-workspace.yaml` 的 `allowBuilds:` 下加一行 `  esbuild: true`，再跑 `pnpm install`。

- [ ] **Step 7: vitest 設定**

建立 `vitest.config.mts`：

```ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

在 `package.json` 的 `scripts` 加入：

```json
"test": "vitest run --passWithNoTests"
```

- [ ] **Step 8: 驗證**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build
```

Expected：全部成功。另外 `git diff app/layout.tsx` 應為空。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui (radix), zustand, vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: history（snapshot 堆疊）

**Files:**
- Create: `lib/store/history.ts`
- Test: `lib/store/history.test.ts`

**Interfaces:**
- Produces:
  - `HISTORY_LIMIT = 100`
  - `type History<T> = { past: T[]; future: T[] }`
  - `emptyHistory<T>(): History<T>`
  - `record<T>(h: History<T>, snapshot: T): History<T>` — 推入 past、截斷至上限、清空 future
  - `undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null`
  - `redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null`
  - `discardLast<T>(h: History<T>): History<T>` — 丟掉 past 最後一筆，future 不變

- [ ] **Step 1: 寫失敗測試**

`lib/store/history.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  discardLast,
  emptyHistory,
  record,
  redo,
  undo,
} from "./history";

describe("history", () => {
  it("undo returns the last recorded snapshot and moves current to future", () => {
    const h = record(emptyHistory<number>(), 1);
    const r = undo(h, 2);
    expect(r).not.toBeNull();
    expect(r!.state).toBe(1);
    expect(r!.history).toEqual({ past: [], future: [2] });
  });

  it("redo reverses undo", () => {
    const afterUndo = undo(record(emptyHistory<number>(), 1), 2)!;
    const r = redo(afterUndo.history, afterUndo.state);
    expect(r!.state).toBe(2);
    expect(r!.history).toEqual({ past: [1], future: [] });
  });

  it("returns null when nothing to undo or redo", () => {
    expect(undo(emptyHistory<number>(), 0)).toBeNull();
    expect(redo(emptyHistory<number>(), 0)).toBeNull();
  });

  it("record clears future", () => {
    const afterUndo = undo(record(emptyHistory<number>(), 1), 2)!;
    const h = record(afterUndo.history, 1);
    expect(h.future).toEqual([]);
  });

  it("caps past at HISTORY_LIMIT, dropping the oldest", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(5);
  });

  it("discardLast drops only the newest past entry", () => {
    const h = record(record(emptyHistory<number>(), 1), 2);
    expect(discardLast(h)).toEqual({ past: [1], future: [] });
    expect(discardLast(emptyHistory<number>())).toEqual({ past: [], future: [] });
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（`Cannot find module './history'` 或同義錯誤）

- [ ] **Step 3: 實作**

`lib/store/history.ts`：

```ts
/** Undo／Redo 的 snapshot 堆疊（純函式，不依賴 React）。 */

export const HISTORY_LIMIT = 100;

export type History<T> = { past: T[]; future: T[] };

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function record<T>(h: History<T>, snapshot: T): History<T> {
  const past = [...h.past, snapshot];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, future: [] };
}

export function undo<T>(
  h: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (h.past.length === 0) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future] },
    state: h.past[h.past.length - 1],
  };
}

export function redo<T>(
  h: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (h.future.length === 0) return null;
  const [state, ...future] = h.future;
  return { history: { past: [...h.past, current], future }, state };
}

export function discardLast<T>(h: History<T>): History<T> {
  return { past: h.past.slice(0, -1), future: h.future };
}
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/store/history.ts lib/store/history.test.ts
git commit -m "feat(store): add undo/redo snapshot history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: persistence（localStorage）

**Files:**
- Create: `lib/store/persistence.ts`
- Test: `lib/store/persistence.test.ts`

**Interfaces:**
- Consumes: `parseCausalJson`, `stringifyCausalJson`, `CausalJsonDocument`（`@/lib/causal-json`）；`CausalLayoutDirection`（`@/lib/causal-auto-layout`）
- Produces:
  - `DOC_KEY`, `CORRUPT_KEY`, `LAYOUT_KEY`
  - `type StorageLike = Pick<Storage, "getItem" | "setItem">`
  - `type LoadStatus = "loaded" | "empty" | "corrupt"`
  - `loadStoredDocument(storage: StorageLike, fallback: CausalJsonDocument): { doc: CausalJsonDocument; status: LoadStatus }`
  - `saveStoredDocument(storage: StorageLike, doc: CausalJsonDocument): boolean`
  - `loadStoredLayout(storage: StorageLike): CausalLayoutDirection`
  - `saveStoredLayout(storage: StorageLike, direction: CausalLayoutDirection): void`

- [ ] **Step 1: 寫失敗測試**

`lib/store/persistence.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import type { CausalJsonDocument } from "@/lib/causal-json";
import {
  CORRUPT_KEY,
  DOC_KEY,
  LAYOUT_KEY,
  loadStoredDocument,
  loadStoredLayout,
  saveStoredDocument,
  saveStoredLayout,
  type StorageLike,
} from "./persistence";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

const FALLBACK: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "fallback",
  nodes: [],
  edges: [],
};

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "存檔",
  nodes: [
    { id: "a", label: "A", x: 1, y: 2 },
    { id: "b", label: "B", x: 3, y: 4 },
  ],
  edges: [
    {
      id: "ab",
      source: "a",
      target: "b",
      direction: "one-way",
      polarity: "negative",
    },
  ],
};

describe("persistence", () => {
  it("round-trips a document", () => {
    const s = new MemoryStorage();
    expect(saveStoredDocument(s, DOC)).toBe(true);
    expect(loadStoredDocument(s, FALLBACK)).toEqual({
      doc: DOC,
      status: "loaded",
    });
  });

  it("returns fallback with status empty when nothing is stored", () => {
    expect(loadStoredDocument(new MemoryStorage(), FALLBACK)).toEqual({
      doc: FALLBACK,
      status: "empty",
    });
  });

  it("backs up corrupt data and returns fallback", () => {
    const s = new MemoryStorage();
    s.setItem(DOC_KEY, "{not json");
    expect(loadStoredDocument(s, FALLBACK)).toEqual({
      doc: FALLBACK,
      status: "corrupt",
    });
    expect(s.getItem(CORRUPT_KEY)).toBe("{not json");
  });

  it("never throws when storage is unavailable", () => {
    expect(loadStoredDocument(throwingStorage, FALLBACK).status).toBe("empty");
    expect(saveStoredDocument(throwingStorage, DOC)).toBe(false);
    expect(loadStoredLayout(throwingStorage)).toBe("LR");
    expect(() => saveStoredLayout(throwingStorage, "TB")).not.toThrow();
  });

  it("stores layout direction, defaulting to LR", () => {
    const s = new MemoryStorage();
    expect(loadStoredLayout(s)).toBe("LR");
    saveStoredLayout(s, "TB");
    expect(s.getItem(LAYOUT_KEY)).toBe("TB");
    expect(loadStoredLayout(s)).toBe("TB");
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（找不到 `./persistence`）

- [ ] **Step 3: 實作**

`lib/store/persistence.ts`：

```ts
import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";
import {
  type CausalJsonDocument,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";

export const DOC_KEY = "causalflow-doc-v1";
export const CORRUPT_KEY = "causalflow-doc-v1-corrupt";
export const LAYOUT_KEY = "causalflow-layout-v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type LoadStatus = "loaded" | "empty" | "corrupt";

export function loadStoredDocument(
  storage: StorageLike,
  fallback: CausalJsonDocument,
): { doc: CausalJsonDocument; status: LoadStatus } {
  let raw: string | null;
  try {
    raw = storage.getItem(DOC_KEY);
  } catch {
    return { doc: fallback, status: "empty" };
  }
  if (raw === null) return { doc: fallback, status: "empty" };
  try {
    return { doc: parseCausalJson(raw), status: "loaded" };
  } catch {
    // 不直接覆蓋壞資料，先備份讓使用者有機會救回。
    try {
      storage.setItem(CORRUPT_KEY, raw);
    } catch {
      /* ignore */
    }
    return { doc: fallback, status: "corrupt" };
  }
}

export function saveStoredDocument(
  storage: StorageLike,
  doc: CausalJsonDocument,
): boolean {
  try {
    storage.setItem(DOC_KEY, stringifyCausalJson(doc));
    return true;
  } catch {
    return false;
  }
}

export function loadStoredLayout(storage: StorageLike): CausalLayoutDirection {
  try {
    return storage.getItem(LAYOUT_KEY) === "TB" ? "TB" : "LR";
  } catch {
    return "LR";
  }
}

export function saveStoredLayout(
  storage: StorageLike,
  direction: CausalLayoutDirection,
): void {
  try {
    storage.setItem(LAYOUT_KEY, direction);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/store/persistence.ts lib/store/persistence.test.ts
git commit -m "feat(store): add localStorage persistence with corrupt backup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: placement（新節點位置）

**Files:**
- Create: `lib/placement.ts`
- Test: `lib/placement.test.ts`

**Interfaces:**
- Consumes: `CausalLayoutDirection`（`@/lib/causal-auto-layout`）
- Produces:
  - `type Point = { x: number; y: number }`
  - `type Rect = Point & { width: number; height: number }`
  - `DEFAULT_NODE_SIZE = { width: 160, height: 60 }`
  - `nodeRect(n: { position: Point; measured?: { width?: number; height?: number } }): Rect`
  - `rectsOverlap(a: Rect, b: Rect): boolean`
  - `downstreamPosition(from: Rect, direction: CausalLayoutDirection, others: Rect[]): Point`
  - `siblingPosition(of: Rect, direction: CausalLayoutDirection, others: Rect[]): Point`

- [ ] **Step 1: 寫失敗測試**

`lib/placement.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_NODE_SIZE,
  downstreamPosition,
  nodeRect,
  rectsOverlap,
  siblingPosition,
  type Rect,
} from "./placement";

const FROM: Rect = { x: 0, y: 0, width: 160, height: 60 };

describe("placement", () => {
  it("nodeRect uses measured size or the default", () => {
    expect(nodeRect({ position: { x: 5, y: 6 } })).toEqual({
      x: 5,
      y: 6,
      ...DEFAULT_NODE_SIZE,
    });
    expect(
      nodeRect({ position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }),
    ).toEqual({ x: 0, y: 0, width: 200, height: 80 });
  });

  it("rectsOverlap ignores touching edges", () => {
    expect(rectsOverlap(FROM, { x: 160, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsOverlap(FROM, { x: 159, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it("downstream goes right in LR and down in TB", () => {
    expect(downstreamPosition(FROM, "LR", [FROM])).toEqual({ x: 240, y: 0 });
    expect(downstreamPosition(FROM, "TB", [FROM])).toEqual({ x: 0, y: 140 });
  });

  it("sibling goes below in LR and right in TB", () => {
    expect(siblingPosition(FROM, "LR", [FROM])).toEqual({ x: 0, y: 100 });
    expect(siblingPosition(FROM, "TB", [FROM])).toEqual({ x: 200, y: 0 });
  });

  it("nudges along the sibling axis until free", () => {
    const blocker: Rect = { x: 240, y: 0, width: 160, height: 60 };
    // y=0 撞、y=40 撞（40 < 60）、y=80 不撞
    expect(downstreamPosition(FROM, "LR", [FROM, blocker])).toEqual({
      x: 240,
      y: 80,
    });
    const tbBlocker: Rect = { x: 0, y: 140, width: 160, height: 60 };
    expect(downstreamPosition(FROM, "TB", [FROM, tbBlocker])).toEqual({
      x: 160,
      y: 140,
    });
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（找不到 `./placement`）

- [ ] **Step 3: 實作**

`lib/placement.ts`：

```ts
import type { CausalLayoutDirection } from "@/lib/causal-auto-layout";

export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };

/** React Flow 尚未量測節點尺寸時的近似值 */
export const DEFAULT_NODE_SIZE = { width: 160, height: 60 };
const FLOW_GAP = 80;
const SIBLING_GAP = 40;
const NUDGE_STEP = 40;
const MAX_NUDGES = 50;

export function nodeRect(n: {
  position: Point;
  measured?: { width?: number; height?: number };
}): Rect {
  return {
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? DEFAULT_NODE_SIZE.width,
    height: n.measured?.height ?? DEFAULT_NODE_SIZE.height,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** 沿同層方向（LR 往下、TB 往右）推到不與任何節點重疊為止 */
function resolveOverlap(
  start: Point,
  others: Rect[],
  direction: CausalLayoutDirection,
): Point {
  let p = start;
  for (let i = 0; i < MAX_NUDGES; i += 1) {
    const rect = { ...p, ...DEFAULT_NODE_SIZE };
    if (!others.some((o) => rectsOverlap(rect, o))) return p;
    p =
      direction === "LR"
        ? { x: p.x, y: p.y + NUDGE_STEP }
        : { x: p.x + NUDGE_STEP, y: p.y };
  }
  return p;
}

export function downstreamPosition(
  from: Rect,
  direction: CausalLayoutDirection,
  others: Rect[],
): Point {
  const base =
    direction === "LR"
      ? { x: from.x + from.width + FLOW_GAP, y: from.y }
      : { x: from.x, y: from.y + from.height + FLOW_GAP };
  return resolveOverlap(base, others, direction);
}

export function siblingPosition(
  of: Rect,
  direction: CausalLayoutDirection,
  others: Rect[],
): Point {
  const base =
    direction === "LR"
      ? { x: of.x, y: of.y + of.height + SIBLING_GAP }
      : { x: of.x + of.width + SIBLING_GAP, y: of.y };
  return resolveOverlap(base, others, direction);
}
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/placement.ts lib/placement.test.ts
git commit -m "feat: add new-node placement with overlap nudging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: navigation（方向鍵鄰居）

**Files:**
- Create: `lib/navigation.ts`
- Test: `lib/navigation.test.ts`

**Interfaces:**
- Consumes: `Rect`（`@/lib/placement`）
- Produces:
  - `type ArrowDirection = "up" | "down" | "left" | "right"`
  - `findNeighbor(from: Rect, candidates: { id: string; rect: Rect }[], direction: ArrowDirection): string | null`

- [ ] **Step 1: 寫失敗測試**

`lib/navigation.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { findNeighbor } from "./navigation";
import type { Rect } from "./placement";

const at = (x: number, y: number): Rect => ({ x, y, width: 100, height: 50 });
const ORIGIN = at(0, 0);

describe("findNeighbor", () => {
  const candidates = [
    { id: "right-near", rect: at(200, 0) },
    { id: "right-far", rect: at(500, 0) },
    { id: "left", rect: at(-300, 0) },
    { id: "down", rect: at(0, 200) },
    { id: "up", rect: at(0, -200) },
  ];

  it("picks the closest node in each direction", () => {
    expect(findNeighbor(ORIGIN, candidates, "right")).toBe("right-near");
    expect(findNeighbor(ORIGIN, candidates, "left")).toBe("left");
    expect(findNeighbor(ORIGIN, candidates, "down")).toBe("down");
    expect(findNeighbor(ORIGIN, candidates, "up")).toBe("up");
  });

  it("excludes nodes outside the 60° cone", () => {
    // 中心差 (100, 200)：與向右夾角約 63.4°，排除
    expect(findNeighbor(ORIGIN, [{ id: "steep", rect: at(100, 200) }], "right")).toBeNull();
    // 中心差 (200, 100)：夾角約 26.6°，納入
    expect(findNeighbor(ORIGIN, [{ id: "ok", rect: at(200, 100) }], "right")).toBe("ok");
  });

  it("includes exactly 60°", () => {
    // 中心差 (100, 173.205...)：cos = 0.5
    const dy = 100 * Math.tan(Math.PI / 3);
    expect(findNeighbor(ORIGIN, [{ id: "edge", rect: at(100, dy) }], "right")).toBe("edge");
  });

  it("returns null when nothing qualifies", () => {
    expect(findNeighbor(ORIGIN, [], "up")).toBeNull();
    expect(findNeighbor(ORIGIN, [{ id: "same", rect: at(0, 0) }], "up")).toBeNull();
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（找不到 `./navigation`）

- [ ] **Step 3: 實作**

`lib/navigation.ts`：

```ts
import type { Rect } from "@/lib/placement";

export type ArrowDirection = "up" | "down" | "left" | "right";

const UNIT: Record<ArrowDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** cos(60°)；浮點誤差容忍 */
const MIN_COS = 0.5 - 1e-9;

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** 在指定方向 60° 錐形內，取中心點距離最近的節點 */
export function findNeighbor(
  from: Rect,
  candidates: { id: string; rect: Rect }[],
  direction: ArrowDirection,
): string | null {
  const origin = center(from);
  const unit = UNIT[direction];
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const p = center(c.rect);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    if ((dx * unit.x + dy * unit.y) / dist < MIN_COS) continue;
    if (dist < bestDist) {
      best = c.id;
      bestDist = dist;
    }
  }
  return best;
}
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/navigation.ts lib/navigation.test.ts
git commit -m "feat: add arrow-key neighbor lookup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: clipboard（片段擷取／實例化）

**Files:**
- Create: `lib/clipboard.ts`
- Test: `lib/clipboard.test.ts`

**Interfaces:**
- Consumes: `flowToDocument`, `jsonNodeToFlow`, `jsonEdgeToFlow`（`@/components/causal/flow-adapters`）；`CausalNodeData`、`CausalEdgeData` 型別；`Point`（`@/lib/placement`）
- Produces:
  - `PASTE_OFFSET = 24`
  - `extractFragment(nodes: Node<CausalNodeData>[], edges: Edge<CausalEdgeData>[]): CausalJsonDocument | null` — 取 `selected` 節點＋兩端都在其中的連線；無選取節點回 `null`
  - `instantiateFragment(doc: CausalJsonDocument, opts: { idSeed: string; anchor?: Point }): { nodes: Node<CausalNodeData>[]; edges: Edge<CausalEdgeData>[] }` — 新 id、新節點 `selected: true`；有 anchor 時片段左上角對齊 anchor，否則偏移 +24

- [ ] **Step 1: 寫失敗測試**

`lib/clipboard.test.ts`：

```ts
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import { documentToFlow } from "@/components/causal/flow-adapters";
import type { CausalJsonDocument } from "@/lib/causal-json";
import { PASTE_OFFSET, extractFragment, instantiateFragment } from "./clipboard";

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  nodes: [
    { id: "a", label: "A", x: 100, y: 100 },
    { id: "b", label: "B", x: 300, y: 100 },
    { id: "c", label: "C", x: 500, y: 100 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive" },
    { id: "bc", source: "b", target: "c", direction: "bidirectional", polarity: "negative" },
  ],
};

function flowWithSelected(ids: string[]) {
  const { nodes, edges } = documentToFlow(DOC);
  return {
    nodes: nodes.map((n) => ({ ...n, selected: ids.includes(n.id) })) as Node<CausalNodeData>[],
    edges: edges as Edge<CausalEdgeData>[],
  };
}

describe("extractFragment", () => {
  it("returns null without selected nodes", () => {
    const { nodes, edges } = flowWithSelected([]);
    expect(extractFragment(nodes, edges)).toBeNull();
  });

  it("keeps only edges with both ends selected", () => {
    const { nodes, edges } = flowWithSelected(["a", "b"]);
    const frag = extractFragment(nodes, edges)!;
    expect(frag.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(frag.edges.map((e) => e.id)).toEqual(["ab"]);
  });
});

describe("instantiateFragment", () => {
  it("assigns fresh ids, remaps edges, offsets and selects", () => {
    const { nodes, edges } = instantiateFragment(DOC, { idSeed: "s1" });
    expect(nodes.map((n) => n.id)).toEqual(["n-s1-0", "n-s1-1", "n-s1-2"]);
    expect(nodes.every((n) => n.selected)).toBe(true);
    expect(nodes[0].position).toEqual({ x: 100 + PASTE_OFFSET, y: 100 + PASTE_OFFSET });
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      ["n-s1-0", "n-s1-1"],
      ["n-s1-1", "n-s1-2"],
    ]);
    expect(edges[1].data).toEqual({ bidirectional: true, polarity: "negative" });
    expect(new Set(edges.map((e) => e.id)).size).toBe(2);
  });

  it("aligns the fragment's top-left to the anchor", () => {
    const { nodes } = instantiateFragment(DOC, { idSeed: "s2", anchor: { x: 0, y: 50 } });
    expect(nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
      { x: 400, y: 50 },
    ]);
  });

  it("returns nothing for an empty fragment", () => {
    const empty: CausalJsonDocument = { causalflowVersion: 1, nodes: [], edges: [] };
    expect(instantiateFragment(empty, { idSeed: "x" })).toEqual({ nodes: [], edges: [] });
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（找不到 `./clipboard`）

- [ ] **Step 3: 實作**

`lib/clipboard.ts`：

```ts
import type { Edge, Node } from "@xyflow/react";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import {
  flowToDocument,
  jsonEdgeToFlow,
  jsonNodeToFlow,
} from "@/components/causal/flow-adapters";
import type { CausalJsonDocument } from "@/lib/causal-json";
import type { Point } from "@/lib/placement";

export const PASTE_OFFSET = 24;

/** 選取的節點＋兩端都在選取內的連線；沒有選取節點時回 null */
export function extractFragment(
  nodes: Node<CausalNodeData>[],
  edges: Edge<CausalEdgeData>[],
): CausalJsonDocument | null {
  const picked = nodes.filter((n) => n.selected);
  if (picked.length === 0) return null;
  const ids = new Set(picked.map((n) => n.id));
  const inner = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return flowToDocument(picked, inner);
}

/** 片段轉成可插入畫布的新節點／連線（全部換新 id） */
export function instantiateFragment(
  doc: CausalJsonDocument,
  opts: { idSeed: string; anchor?: Point },
): { nodes: Node<CausalNodeData>[]; edges: Edge<CausalEdgeData>[] } {
  if (doc.nodes.length === 0) return { nodes: [], edges: [] };
  const minX = Math.min(...doc.nodes.map((n) => n.x));
  const minY = Math.min(...doc.nodes.map((n) => n.y));
  const dx = opts.anchor ? opts.anchor.x - minX : PASTE_OFFSET;
  const dy = opts.anchor ? opts.anchor.y - minY : PASTE_OFFSET;
  const idMap = new Map(
    doc.nodes.map((n, i) => [n.id, `n-${opts.idSeed}-${i}`] as const),
  );

  const nodes = doc.nodes.map((n) => ({
    ...jsonNodeToFlow({ ...n, id: idMap.get(n.id)!, x: n.x + dx, y: n.y + dy }),
    selected: true,
  }));
  const edges = doc.edges.flatMap((e, i) => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) return [];
    return [jsonEdgeToFlow({ ...e, id: `e-${source}-${target}-${i}`, source, target })];
  });
  return { nodes, edges };
}
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS。若因 `@xyflow/react` 在 node 環境載入失敗而報錯，改在 `vitest.config.mts` 的 `test` 加 `server: { deps: { inline: ["@xyflow/react"] } }` 再跑一次。

- [ ] **Step 5: Commit**

```bash
git add lib/clipboard.ts lib/clipboard.test.ts vitest.config.mts
git commit -m "feat: add clipboard fragment extract/instantiate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: zustand store

**Files:**
- Create: `lib/store/causal-store.ts`
- Test: `lib/store/causal-store.test.ts`

**Interfaces:**
- Consumes: Task 2 `history`、Task 6 `instantiateFragment`、`documentToFlow` / `newFlowEdge` / `withMarkers`（flow-adapters）、`layoutCausalNodes`
- Produces（後續所有 UI task 依賴這些名字）：
  - `type FlowNode = Node<CausalNodeData>`、`type FlowEdge = Edge<CausalEdgeData>`
  - `type Snapshot = { nodes; edges; title; layoutDirection }`
  - `type EditingState = { id: string; isNew: boolean } | null`
  - `NEW_NODE_LABEL = "新節點"`、`DUPLICATE_EDGE_MESSAGE = "兩節點之間已有連線"`
  - `uid(): string`
  - `useCausalStore`，state 欄位：`nodes, edges, title, layoutDirection, defaultPolarity, defaultBidirectional, history, editing, toast, exporting`
  - actions：
    - `onNodesChange(changes: NodeChange<FlowNode>[])`、`onEdgesChange(changes: EdgeChange<FlowEdge>[])`（不 commit）
    - `commit()`、`undo()`、`redo()`
    - `replaceDocument(doc, layoutDirection?)`（不 commit，hydrate 用）
    - `importDocument(doc)`（commit＋replace）
    - `newBlank()`
    - `setTitle(title)`（不 commit）
    - `setDefaultPolarity(p)`、`setDefaultBidirectional(b)`
    - `addNode(position: XYPosition, opts?: { edit?: boolean }): string`
    - `addConnectedNode(anchorId: string, position: XYPosition, side: "downstream" | "upstream"): string`（一定進入編輯）
    - `connect(source, target): boolean`
    - `updateNodeLabel(id, label)`（不 commit）
    - `updateEdge(id, patch: Partial<CausalEdgeData>)`
    - `reverseEdge(id): boolean`
    - `deleteSelected()`
    - `selectNodes(ids: string[])`、`selectEdge(id)`、`selectAll()`、`clearSelection()`
    - `pasteFragment(doc, anchor?: XYPosition)`
    - `applyLayout(direction)`
    - `startEditing(id)`、`finishEditing(label: string | null)`
    - `showToast(message)`、`setExporting(b)`

- [ ] **Step 1: 寫失敗測試**

`lib/store/causal-store.test.ts`：

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { CAUSAL_EDGE_STROKE_HEX } from "@/lib/causal-edge-palette";
import type { CausalJsonDocument } from "@/lib/causal-json";
import { extractFragment } from "@/lib/clipboard";
import {
  DUPLICATE_EDGE_MESSAGE,
  NEW_NODE_LABEL,
  useCausalStore,
} from "./causal-store";

const DOC: CausalJsonDocument = {
  causalflowVersion: 1,
  title: "t",
  nodes: [
    { id: "a", label: "A", x: 0, y: 0 },
    { id: "b", label: "B", x: 200, y: 0 },
    { id: "c", label: "C", x: 400, y: 0 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", direction: "one-way", polarity: "positive" },
  ],
};

const s = () => useCausalStore.getState();
const ids = () => s().nodes.map((n) => n.id);

beforeEach(() => {
  useCausalStore.setState(useCausalStore.getInitialState(), true);
  s().replaceDocument(DOC, "LR");
});

describe("causal store", () => {
  it("addNode selects the new node and is undoable/redoable", () => {
    const id = s().addNode({ x: 1, y: 2 });
    expect(ids()).toContain(id);
    expect(s().nodes.find((n) => n.id === id)?.data.label).toBe(NEW_NODE_LABEL);
    expect(s().nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([id]);
    s().undo();
    expect(ids()).not.toContain(id);
    s().redo();
    expect(ids()).toContain(id);
  });

  it("cancelling a new connected node removes it and its history entry", () => {
    const before = s().history.past.length;
    const id = s().addConnectedNode("a", { x: 0, y: 200 }, "downstream");
    expect(s().editing).toEqual({ id, isNew: true });
    expect(s().edges.some((e) => e.source === "a" && e.target === id)).toBe(true);
    s().finishEditing(null);
    expect(ids()).not.toContain(id);
    expect(s().edges).toHaveLength(1);
    expect(s().history.past.length).toBe(before);
    expect(s().editing).toBeNull();
  });

  it("upstream side creates an edge into the anchor", () => {
    const id = s().addConnectedNode("a", { x: -200, y: 0 }, "upstream");
    expect(s().edges.some((e) => e.source === id && e.target === "a")).toBe(true);
  });

  it("confirming a new node stores the trimmed label", () => {
    const id = s().addNode({ x: 0, y: 0 }, { edit: true });
    s().finishEditing("  X  ");
    expect(s().nodes.find((n) => n.id === id)?.data.label).toBe("X");
    expect(s().editing).toBeNull();
  });

  it("editing an existing node without change discards the commit", () => {
    const before = s().history.past.length;
    s().startEditing("a");
    expect(s().history.past.length).toBe(before + 1);
    s().finishEditing("A");
    expect(s().history.past.length).toBe(before);
  });

  it("editing an existing node to empty keeps the old label", () => {
    s().startEditing("a");
    s().finishEditing("   ");
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A");
  });

  it("editing an existing node is undoable", () => {
    s().startEditing("a");
    s().finishEditing("A2");
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A2");
    s().undo();
    expect(s().nodes.find((n) => n.id === "a")?.data.label).toBe("A");
  });

  it("connect rejects duplicates with a toast", () => {
    expect(s().connect("a", "b")).toBe(false);
    expect(s().toast).toBe(DUPLICATE_EDGE_MESSAGE);
    expect(s().connect("b", "c")).toBe(true);
    expect(s().edges).toHaveLength(2);
  });

  it("reverseEdge swaps ends and refuses to create a duplicate", () => {
    expect(s().reverseEdge("ab")).toBe(true);
    const e = s().edges.find((x) => x.id === "ab")!;
    expect([e.source, e.target]).toEqual(["b", "a"]);
    expect(s().connect("a", "b")).toBe(true);
    const added = s().edges.find((x) => x.source === "a" && x.target === "b")!;
    expect(s().reverseEdge(added.id)).toBe(false);
  });

  it("updateEdge changes polarity and marker color", () => {
    s().updateEdge("ab", { polarity: "negative" });
    const e = s().edges.find((x) => x.id === "ab")!;
    expect(e.data?.polarity).toBe("negative");
    expect(e.markerEnd).toMatchObject({ color: CAUSAL_EDGE_STROKE_HEX.negative });
  });

  it("deleteSelected removes edges touching deleted nodes and is undoable", () => {
    s().selectNodes(["b"]);
    s().deleteSelected();
    expect(ids()).toEqual(["a", "c"]);
    expect(s().edges).toHaveLength(0);
    s().undo();
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(s().edges).toHaveLength(1);
  });

  it("deleteSelected with nothing selected does not record history", () => {
    const before = s().history.past.length;
    s().deleteSelected();
    expect(s().history.past.length).toBe(before);
  });

  it("pasteFragment adds selected copies with fresh ids", () => {
    s().selectNodes(["a", "b"]);
    const frag = extractFragment(s().nodes, s().edges)!;
    s().pasteFragment(frag);
    const selected = s().nodes.filter((n) => n.selected).map((n) => n.id);
    expect(s().nodes).toHaveLength(5);
    expect(selected).toHaveLength(2);
    expect(selected.some((id) => ["a", "b", "c"].includes(id))).toBe(false);
    expect(s().edges).toHaveLength(2);
  });

  it("undo of applyLayout restores direction and positions", () => {
    s().applyLayout("TB");
    expect(s().layoutDirection).toBe("TB");
    s().undo();
    expect(s().layoutDirection).toBe("LR");
    expect(s().nodes.find((n) => n.id === "a")?.position).toEqual({ x: 0, y: 0 });
  });

  it("newBlank clears the document and is undoable", () => {
    s().newBlank();
    expect(s().nodes).toHaveLength(0);
    expect(s().title).toBe("");
    s().undo();
    expect(s().nodes).toHaveLength(3);
    expect(s().title).toBe("t");
  });

  it("snapshots never carry selection", () => {
    s().selectNodes(["a"]);
    s().commit();
    const snap = s().history.past.at(-1)!;
    expect(snap.nodes.some((n) => n.selected)).toBe(false);
  });
});
```

- [ ] **Step 2: 確認失敗**

Run: `pnpm test`
Expected: FAIL（找不到 `./causal-store`）

- [ ] **Step 3: 實作**

`lib/store/causal-store.ts`：

```ts
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import type { CausalEdgeData } from "@/components/causal/causal-edge";
import type { CausalNodeData } from "@/components/causal/causal-node";
import {
  documentToFlow,
  newFlowEdge,
  withMarkers,
} from "@/components/causal/flow-adapters";
import {
  type CausalLayoutDirection,
  layoutCausalNodes,
} from "@/lib/causal-auto-layout";
import type { CausalJsonDocument, CausalPolarity } from "@/lib/causal-json";
import { instantiateFragment } from "@/lib/clipboard";
import {
  discardLast,
  emptyHistory,
  type History,
  record,
  redo as redoHistory,
  undo as undoHistory,
} from "@/lib/store/history";

export type FlowNode = Node<CausalNodeData>;
export type FlowEdge = Edge<CausalEdgeData>;

/** undo 單位：不含 selection 與 viewport */
export type Snapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  title: string;
  layoutDirection: CausalLayoutDirection;
};

export type EditingState = { id: string; isNew: boolean } | null;

export const NEW_NODE_LABEL = "新節點";
export const DUPLICATE_EDGE_MESSAGE = "兩節點之間已有連線";
const TOAST_MS = 3200;

let seq = 0;
export function uid(): string {
  seq += 1;
  return `${Date.now().toString(36)}${seq.toString(36)}`;
}

function deselectNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
}

function deselectEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((e) => (e.selected ? { ...e, selected: false } : e));
}

function hasEdge(edges: FlowEdge[], source: string, target: string): boolean {
  return edges.some((e) => e.source === source && e.target === target);
}

function newNode(id: string, position: XYPosition): FlowNode {
  return {
    id,
    type: "causal",
    position,
    data: { label: NEW_NODE_LABEL },
    selected: true,
  };
}

export type CausalState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  title: string;
  layoutDirection: CausalLayoutDirection;
  defaultPolarity: CausalPolarity;
  defaultBidirectional: boolean;
  history: History<Snapshot>;
  editing: EditingState;
  toast: string | null;
  exporting: boolean;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  replaceDocument: (
    doc: CausalJsonDocument,
    layoutDirection?: CausalLayoutDirection,
  ) => void;
  importDocument: (doc: CausalJsonDocument) => void;
  newBlank: () => void;
  setTitle: (title: string) => void;
  setDefaultPolarity: (polarity: CausalPolarity) => void;
  setDefaultBidirectional: (bidirectional: boolean) => void;
  addNode: (position: XYPosition, opts?: { edit?: boolean }) => string;
  addConnectedNode: (
    anchorId: string,
    position: XYPosition,
    side: "downstream" | "upstream",
  ) => string;
  connect: (source: string, target: string) => boolean;
  updateNodeLabel: (id: string, label: string) => void;
  updateEdge: (id: string, patch: Partial<CausalEdgeData>) => void;
  reverseEdge: (id: string) => boolean;
  deleteSelected: () => void;
  selectNodes: (ids: string[]) => void;
  selectEdge: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  pasteFragment: (doc: CausalJsonDocument, anchor?: XYPosition) => void;
  applyLayout: (direction: CausalLayoutDirection) => void;
  startEditing: (id: string) => void;
  finishEditing: (label: string | null) => void;
  showToast: (message: string) => void;
  setExporting: (exporting: boolean) => void;
};

export const useCausalStore = create<CausalState>()((set, get) => {
  const snapshot = (): Snapshot => {
    const s = get();
    return {
      nodes: s.nodes.map((n) => ({ ...n, selected: false, dragging: false })),
      edges: deselectEdges(s.edges),
      title: s.title,
      layoutDirection: s.layoutDirection,
    };
  };

  const commit = () => set((s) => ({ history: record(s.history, snapshot()) }));

  const edgeDefaults = (): CausalEdgeData => ({
    bidirectional: get().defaultBidirectional,
    polarity: get().defaultPolarity,
  });

  return {
    nodes: [],
    edges: [],
    title: "",
    layoutDirection: "LR",
    defaultPolarity: "positive",
    defaultBidirectional: false,
    history: emptyHistory<Snapshot>(),
    editing: null,
    toast: null,
    exporting: false,

    onNodesChange: (changes) =>
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

    commit,

    undo: () => {
      const r = undoHistory(get().history, snapshot());
      if (r) set({ ...r.state, history: r.history, editing: null });
    },

    redo: () => {
      const r = redoHistory(get().history, snapshot());
      if (r) set({ ...r.state, history: r.history, editing: null });
    },

    replaceDocument: (doc, layoutDirection) => {
      const { nodes, edges } = documentToFlow(doc);
      set((s) => ({
        nodes,
        edges,
        title: doc.title ?? "",
        layoutDirection: layoutDirection ?? s.layoutDirection,
        editing: null,
      }));
    },

    importDocument: (doc) => {
      commit();
      get().replaceDocument(doc);
    },

    newBlank: () => {
      commit();
      set({ nodes: [], edges: [], title: "", editing: null });
    },

    setTitle: (title) => set({ title }),
    setDefaultPolarity: (defaultPolarity) => set({ defaultPolarity }),
    setDefaultBidirectional: (defaultBidirectional) =>
      set({ defaultBidirectional }),

    addNode: (position, opts) => {
      commit();
      const id = `n-${uid()}`;
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), newNode(id, position)],
        edges: deselectEdges(s.edges),
        editing: opts?.edit ? { id, isNew: true } : s.editing,
      }));
      return id;
    },

    addConnectedNode: (anchorId, position, side) => {
      commit();
      const id = `n-${uid()}`;
      const [source, target] =
        side === "downstream" ? [anchorId, id] : [id, anchorId];
      const edge = newFlowEdge(
        `e-${source}-${target}-${uid()}`,
        source,
        target,
        edgeDefaults(),
      );
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), newNode(id, position)],
        edges: [...deselectEdges(s.edges), edge],
        editing: { id, isNew: true },
      }));
      return id;
    },

    connect: (source, target) => {
      if (hasEdge(get().edges, source, target)) {
        get().showToast(DUPLICATE_EDGE_MESSAGE);
        return false;
      }
      commit();
      const edge = newFlowEdge(
        `e-${source}-${target}-${uid()}`,
        source,
        target,
        edgeDefaults(),
      );
      set((s) => ({ edges: [...s.edges, edge] }));
      return true;
    },

    updateNodeLabel: (id, label) =>
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label } } : n,
        ),
      })),

    updateEdge: (id, patch) => {
      commit();
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id !== id
            ? e
            : withMarkers({
                ...e,
                data: {
                  bidirectional: e.data?.bidirectional ?? false,
                  polarity: e.data?.polarity ?? "positive",
                  ...patch,
                },
              }),
        ),
      }));
    },

    reverseEdge: (id) => {
      const edge = get().edges.find((e) => e.id === id);
      if (!edge) return false;
      if (hasEdge(get().edges, edge.target, edge.source)) {
        get().showToast(DUPLICATE_EDGE_MESSAGE);
        return false;
      }
      commit();
      set((s) => ({
        edges: s.edges.map((e) =>
          e.id === id ? { ...e, source: edge.target, target: edge.source } : e,
        ),
      }));
      return true;
    },

    deleteSelected: () => {
      const { nodes, edges } = get();
      const doomed = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      const keptEdges = edges.filter(
        (e) => !e.selected && !doomed.has(e.source) && !doomed.has(e.target),
      );
      if (doomed.size === 0 && keptEdges.length === edges.length) return;
      commit();
      set({ nodes: nodes.filter((n) => !doomed.has(n.id)), edges: keptEdges });
    },

    selectNodes: (ids) => {
      const wanted = new Set(ids);
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: wanted.has(n.id) })),
        edges: deselectEdges(s.edges),
      }));
    },

    selectEdge: (id) =>
      set((s) => ({
        nodes: deselectNodes(s.nodes),
        edges: s.edges.map((e) => ({ ...e, selected: e.id === id })),
      })),

    selectAll: () =>
      set((s) => ({
        nodes: s.nodes.map((n) => ({ ...n, selected: true })),
        edges: s.edges.map((e) => ({ ...e, selected: true })),
      })),

    clearSelection: () =>
      set((s) => ({
        nodes: deselectNodes(s.nodes),
        edges: deselectEdges(s.edges),
      })),

    pasteFragment: (doc, anchor) => {
      if (doc.nodes.length === 0) return;
      commit();
      const frag = instantiateFragment(doc, { idSeed: uid(), anchor });
      set((s) => ({
        nodes: [...deselectNodes(s.nodes), ...frag.nodes],
        edges: [...deselectEdges(s.edges), ...frag.edges],
      }));
    },

    applyLayout: (direction) => {
      commit();
      set((s) => ({
        layoutDirection: direction,
        nodes: layoutCausalNodes(s.nodes, s.edges, direction),
      }));
    },

    startEditing: (id) => {
      if (!get().nodes.some((n) => n.id === id)) return;
      commit();
      set({ editing: { id, isNew: false } });
    },

    finishEditing: (label) => {
      const { editing, nodes } = get();
      if (!editing) return;
      const text = label?.trim() ?? "";
      const previous = nodes.find((n) => n.id === editing.id)?.data.label;

      if (!text && editing.isNew) {
        // 取消新建：移除節點並丟掉建立時那筆歷史，等同從沒建過
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== editing.id),
          edges: s.edges.filter(
            (e) => e.source !== editing.id && e.target !== editing.id,
          ),
          history: discardLast(s.history),
          editing: null,
        }));
        return;
      }
      if (!text || (!editing.isNew && text === previous)) {
        set((s) => ({ history: discardLast(s.history), editing: null }));
        return;
      }
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === editing.id ? { ...n, data: { ...n.data, label: text } } : n,
        ),
        editing: null,
      }));
    },

    showToast: (message) => {
      set({ toast: message });
      setTimeout(() => {
        if (get().toast === message) set({ toast: null });
      }, TOAST_MS);
    },

    setExporting: (exporting) => set({ exporting }),
  };
});
```

- [ ] **Step 4: 確認通過**

Run: `pnpm test`
Expected: PASS（全部測試）

- [ ] **Step 5: tsc＋lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 無錯誤

- [ ] **Step 6: Commit**

```bash
git add lib/store/causal-store.ts lib/store/causal-store.test.ts
git commit -m "feat(store): add zustand causal store with undo-aware actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: UI 基礎模組（commands、autosave、toolbar、inspector、JSON 編輯器）

本 task 只新增檔案，不改 `causal-flow-app.tsx`；完成標準是 tsc／lint 通過。下一個 task 才接上。

**Files:**
- Create: `components/causal/ui-classes.ts`
- Create: `components/causal/use-stored-flag.ts`
- Create: `components/causal/use-autosave.ts`
- Create: `components/causal/use-causal-commands.ts`
- Create: `components/causal/inspector.tsx`
- Create: `components/causal/toolbar.tsx`
- Create: `components/causal/json-editor-dialog.tsx`

**Interfaces:**
- Consumes: Task 3–7 的所有 export
- Produces:
  - `shellBtn`、`shellBtnPrimary`、`POLARITY_OPTIONS`、`chipClass(active, activeClass)`、`modKeyLabel()`（ui-classes）
  - `useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void]`
  - `hydrateFromStorage(): void`、`useAutosave(): void`
  - `useCausalCommands(flowWrapRef): CausalCommands`，`CausalCommands` 方法：
    `undo, redo, autoLayout, toggleOrientation, newBlank, addNodeAtCenter, addNodeAtScreen(point), addConnectedNodeAtScreen(anchorId, point, side), createDownstream(): boolean, createSibling(): boolean, editSelected(): boolean, editNode(id), navigate(dir): boolean, selectAll, clearSelection, deleteSelected, copySelection(): CausalJsonDocument | null, copyToSystemClipboard, cutSelection, pasteDocument(doc | null, anchorScreen?): boolean, duplicate, setSelectedEdgePolarity(p): boolean, toggleSelectedEdgeDirection(): boolean, reverseSelectedEdge, focusNode(id), importText(text): string | null, currentJson(): string, exportJson, exportImage(kind, orientation?)`
  - `hasInternalClipboard(): boolean`
  - `<Toolbar commands onImportFile onOpenJsonEditor onOpenPalette? onOpenShortcuts? />`
  - `<Inspector />`
  - `<JsonEditorDialog commands onClose />`

- [ ] **Step 1: ui-classes.ts**

```ts
import type { CausalPolarity } from "@/lib/causal-json";

export const shellBtn =
  "causal-ui rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2 py-1.5 text-xs text-[var(--causal-ink)] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50";

export const shellBtnPrimary =
  "causal-ui rounded-lg bg-[var(--causal-accent)] px-2 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const POLARITY_OPTIONS: {
  value: CausalPolarity;
  label: string;
  activeClass: string;
}[] = [
  { value: "positive", label: "正", activeClass: "bg-[var(--causal-edge-pos-muted)]" },
  { value: "negative", label: "負", activeClass: "bg-[var(--causal-edge-neg-muted)]" },
  { value: "neutral", label: "未指定", activeClass: "bg-[var(--causal-edge-neutral-muted)]" },
];

export function chipClass(active: boolean, activeClass: string): string {
  return `causal-ui rounded-md px-2 py-1 text-[11px] ${
    active
      ? `${activeClass} text-[var(--causal-ink)]`
      : "bg-[var(--causal-paper-2)] text-[var(--causal-ink-muted)]"
  }`;
}

/** 快捷鍵顯示用：Mac 顯示 ⌘，其餘 Ctrl */
export function modKeyLabel(): string {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
}
```

- [ ] **Step 2: use-stored-flag.ts**

```ts
"use client";

import { useState } from "react";

/** localStorage 記住的布林 UI 狀態（收合等）。元件只在 client 端渲染。 */
export function useStoredFlag(
  key: string,
  initial: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [value, update];
}
```

- [ ] **Step 3: use-autosave.ts**

```ts
"use client";

import { useEffect } from "react";
import { SAMPLE_CAUSAL_DOCUMENT } from "@/lib/sample-causal";
import { useCausalStore } from "@/lib/store/causal-store";
import {
  loadStoredDocument,
  loadStoredLayout,
  saveStoredDocument,
  saveStoredLayout,
  type StorageLike,
} from "@/lib/store/persistence";
import { flowToDocument } from "./flow-adapters";

const SAVE_DEBOUNCE_MS = 500;

const unavailableStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error("localStorage unavailable");
  },
};

/** 隱私模式下存取 window.localStorage 本身就可能丟例外 */
function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return unavailableStorage;
  }
}

export function hydrateFromStorage(): void {
  const storage = browserStorage();
  const { doc, status } = loadStoredDocument(storage, SAMPLE_CAUSAL_DOCUMENT);
  const store = useCausalStore.getState();
  store.replaceDocument(doc, loadStoredLayout(storage));
  if (status === "corrupt") {
    store.showToast("存檔損毀，已載入範例（原資料已備份）");
  }
}

export function useAutosave(): void {
  useEffect(() => {
    const storage = browserStorage();
    let timer: number | undefined;
    let warned = false;

    const save = () => {
      window.clearTimeout(timer);
      timer = undefined;
      const { nodes, edges, title, layoutDirection, showToast } =
        useCausalStore.getState();
      const ok = saveStoredDocument(
        storage,
        flowToDocument(nodes, edges, title.trim() || undefined),
      );
      saveStoredLayout(storage, layoutDirection);
      if (!ok && !warned) {
        warned = true;
        showToast("無法自動存檔");
      }
    };

    const unsubscribe = useCausalStore.subscribe((s, prev) => {
      if (
        s.nodes === prev.nodes &&
        s.edges === prev.edges &&
        s.title === prev.title &&
        s.layoutDirection === prev.layoutDirection
      ) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
    });

    const flush = () => {
      if (timer !== undefined) save();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}
```

- [ ] **Step 4: use-causal-commands.ts**

```ts
"use client";

import { useReactFlow, type XYPosition } from "@xyflow/react";
import { type RefObject, useMemo } from "react";
import { flushSync } from "react-dom";
import {
  type CausalLayoutDirection,
  layoutCausalNodes,
} from "@/lib/causal-auto-layout";
import { captureViewportToPngDataUrl, downloadPdfFromPngDataUrl, downloadPngFromDataUrl, safeExportBasename } from "@/lib/causal-flow-export";
import {
  type CausalJsonDocument,
  CausalJsonError,
  type CausalPolarity,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { extractFragment } from "@/lib/clipboard";
import { type ArrowDirection, findNeighbor } from "@/lib/navigation";
import { downstreamPosition, nodeRect, siblingPosition } from "@/lib/placement";
import { type FlowNode, useCausalStore } from "@/lib/store/causal-store";
import { flowToDocument } from "./flow-adapters";

/** 新節點以游標為中心放置時的半寬／半高 */
const NODE_HALF = { x: 70, y: 28 };

let internalClipboard: CausalJsonDocument | null = null;

export function hasInternalClipboard(): boolean {
  return internalClipboard !== null;
}

const store = () => useCausalStore.getState();

function singleSelectedNode(): FlowNode | null {
  const picked = store().nodes.filter((n) => n.selected);
  return picked.length === 1 ? picked[0] : null;
}

function singleSelectedEdgeId(): string | null {
  const { nodes, edges } = store();
  if (nodes.some((n) => n.selected)) return null;
  const picked = edges.filter((e) => e.selected);
  return picked.length === 1 ? picked[0].id : null;
}

function centered(p: XYPosition): XYPosition {
  return { x: p.x - NODE_HALF.x, y: p.y - NODE_HALF.y };
}

export type CausalCommands = ReturnType<typeof useCausalCommands>;

export function useCausalCommands(
  flowWrapRef: RefObject<HTMLDivElement | null>,
) {
  const { screenToFlowPosition, fitView, getViewport, setViewport, setCenter } =
    useReactFlow();

  return useMemo(() => {
    const relayout = (direction: CausalLayoutDirection) => {
      flushSync(() => store().applyLayout(direction));
      void fitView({ padding: 0.2, duration: 280 });
    };

    const ensureVisible = (id: string) => {
      const node = store().nodes.find((n) => n.id === id);
      if (!node) return;
      const r = nodeRect(node);
      const { x, y, zoom } = getViewport();
      const left = r.x * zoom + x;
      const top = r.y * zoom + y;
      const inside =
        left >= 0 &&
        top >= 0 &&
        left + r.width * zoom <= window.innerWidth &&
        top + r.height * zoom <= window.innerHeight;
      if (inside) return;
      void setCenter(r.x + r.width / 2, r.y + r.height / 2, {
        zoom,
        duration: 200,
      });
    };

    const allRects = () => store().nodes.map(nodeRect);

    const copySelection = (): CausalJsonDocument | null => {
      const frag = extractFragment(store().nodes, store().edges);
      if (frag) internalClipboard = frag;
      return frag;
    };

    const currentJson = () => {
      const { nodes, edges, title } = store();
      return stringifyCausalJson(
        flowToDocument(nodes, edges, title.trim() || undefined),
      );
    };

    return {
      undo: () => store().undo(),
      redo: () => store().redo(),
      autoLayout: () => relayout(store().layoutDirection),
      toggleOrientation: () =>
        relayout(store().layoutDirection === "LR" ? "TB" : "LR"),

      newBlank: () => {
        store().newBlank();
        store().showToast("已清空，可按 ⌘/Ctrl+Z 復原");
      },

      addNodeAtCenter: () => {
        const p = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        store().addNode(centered(p), { edit: true });
      },

      addNodeAtScreen: (point: XYPosition) => {
        store().addNode(centered(screenToFlowPosition(point)), { edit: true });
      },

      addConnectedNodeAtScreen: (
        anchorId: string,
        point: XYPosition,
        side: "downstream" | "upstream",
      ) => {
        store().addConnectedNode(
          anchorId,
          centered(screenToFlowPosition(point)),
          side,
        );
      },

      createDownstream: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const pos = downstreamPosition(
          nodeRect(n),
          store().layoutDirection,
          allRects(),
        );
        ensureVisible(store().addConnectedNode(n.id, pos, "downstream"));
        return true;
      },

      createSibling: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const pos = siblingPosition(
          nodeRect(n),
          store().layoutDirection,
          allRects(),
        );
        const upstream = store().edges.find((e) => e.target === n.id)?.source;
        const id = upstream
          ? store().addConnectedNode(upstream, pos, "downstream")
          : store().addNode(pos, { edit: true });
        ensureVisible(id);
        return true;
      },

      editSelected: (): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        store().startEditing(n.id);
        return true;
      },

      editNode: (id: string) => {
        store().selectNodes([id]);
        store().startEditing(id);
      },

      navigate: (direction: ArrowDirection): boolean => {
        const n = singleSelectedNode();
        if (!n) return false;
        const candidates = store()
          .nodes.filter((o) => o.id !== n.id)
          .map((o) => ({ id: o.id, rect: nodeRect(o) }));
        const next = findNeighbor(nodeRect(n), candidates, direction);
        if (next) {
          store().selectNodes([next]);
          ensureVisible(next);
        }
        return true;
      },

      selectAll: () => store().selectAll(),
      clearSelection: () => store().clearSelection(),
      deleteSelected: () => store().deleteSelected(),

      copySelection,

      copyToSystemClipboard: () => {
        const frag = copySelection();
        if (!frag) return;
        void navigator.clipboard
          ?.writeText(stringifyCausalJson(frag))
          .catch(() => undefined);
        store().showToast(`已複製 ${frag.nodes.length} 個節點`);
      },

      cutSelection: () => {
        if (copySelection()) store().deleteSelected();
      },

      pasteDocument: (
        doc: CausalJsonDocument | null,
        anchorScreen?: XYPosition,
      ): boolean => {
        const source = doc ?? internalClipboard;
        if (!source) return false;
        store().pasteFragment(
          source,
          anchorScreen ? screenToFlowPosition(anchorScreen) : undefined,
        );
        return true;
      },

      duplicate: () => {
        const frag = extractFragment(store().nodes, store().edges);
        if (frag) store().pasteFragment(frag);
      },

      setSelectedEdgePolarity: (polarity: CausalPolarity): boolean => {
        const id = singleSelectedEdgeId();
        if (!id) return false;
        store().updateEdge(id, { polarity });
        return true;
      },

      toggleSelectedEdgeDirection: (): boolean => {
        const id = singleSelectedEdgeId();
        if (!id) return false;
        const edge = store().edges.find((e) => e.id === id);
        store().updateEdge(id, { bidirectional: !edge?.data?.bidirectional });
        return true;
      },

      reverseSelectedEdge: () => {
        const id = singleSelectedEdgeId();
        if (id) store().reverseEdge(id);
      },

      focusNode: (id: string) => {
        store().selectNodes([id]);
        void fitView({ nodes: [{ id }], duration: 280, maxZoom: 1.2, padding: 0.6 });
      },

      importText: (text: string): string | null => {
        try {
          store().importDocument(parseCausalJson(text));
          return null;
        } catch (err) {
          return err instanceof CausalJsonError ? err.message : "匯入失敗";
        }
      },

      currentJson,

      exportJson: () => {
        const blob = new Blob([currentJson()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "causalflow.json";
        a.click();
        URL.revokeObjectURL(a.href);
        store().showToast("已下載 causalflow.json");
      },

      exportImage: async (
        kind: "png" | "pdf",
        pdfOrientation: "portrait" | "landscape" = "portrait",
      ) => {
        const viewportEl = flowWrapRef.current?.querySelector(
          ".react-flow__viewport",
        ) as HTMLElement | null;
        if (!viewportEl) {
          store().showToast("無法匯出：找不到畫布");
          return;
        }
        const prevViewport = getViewport();
        const { nodes: prevNodes, edges, layoutDirection: prevDirection, title } =
          store();
        const targetDirection: CausalLayoutDirection =
          pdfOrientation === "portrait" ? "TB" : "LR";
        const relayoutForPdf = kind === "pdf" && targetDirection !== prevDirection;
        store().setExporting(true);
        try {
          if (relayoutForPdf) {
            // 匯出前先重排成目標方向，避免「直式 PDF 只是縮小橫圖」。不進歷史。
            flushSync(() =>
              useCausalStore.setState({
                layoutDirection: targetDirection,
                nodes: layoutCausalNodes(prevNodes, edges, targetDirection),
              }),
            );
          }
          await fitView({ padding: 0.15, duration: 0 });
          await new Promise<void>((r) => {
            requestAnimationFrame(() => requestAnimationFrame(() => r()));
          });
          const base = safeExportBasename(title);
          if (kind === "png") {
            const dataUrl = await captureViewportToPngDataUrl(viewportEl);
            downloadPngFromDataUrl(dataUrl, `${base}.png`);
            store().showToast("已下載 PNG");
          } else {
            // PDF 走高解析位圖，提升文字與線條清晰度。
            const dataUrl = await captureViewportToPngDataUrl(viewportEl, {
              pixelRatio: 4,
            });
            await downloadPdfFromPngDataUrl(dataUrl, `${base}.pdf`, {
              orientation: pdfOrientation,
            });
            store().showToast(
              pdfOrientation === "portrait"
                ? "已下載 PDF（直式 A4）"
                : "已下載 PDF（橫式 A4）",
            );
          }
        } catch {
          store().showToast(kind === "png" ? "PNG 匯出失敗" : "PDF 匯出失敗");
        } finally {
          if (relayoutForPdf) {
            flushSync(() =>
              useCausalStore.setState({
                layoutDirection: prevDirection,
                nodes: prevNodes,
              }),
            );
          }
          void setViewport(prevViewport, { duration: 0 });
          store().setExporting(false);
        }
      },
    };
  }, [fitView, flowWrapRef, getViewport, screenToFlowPosition, setCenter, setViewport]);
}
```

註：`captureViewportToPngDataUrl` 的第二參數型別請對照 `lib/causal-flow-export.ts`；舊程式就是這樣呼叫的，保持一致。

- [ ] **Step 5: inspector.tsx**

```tsx
"use client";

import { useId, useRef, useState } from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import { chipClass, POLARITY_OPTIONS } from "./ui-classes";

function NodeLabelField({ id, label }: { id: string; label: string }) {
  const fieldId = useId();
  const commit = useCausalStore((s) => s.commit);
  const updateNodeLabel = useCausalStore((s) => s.updateNodeLabel);
  // 聚焦期間顯示草稿；空白不寫回 store，避免存出空 label
  const [draft, setDraft] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  return (
    <>
      <label htmlFor={fieldId} className="sr-only">
        節點文字
      </label>
      <textarea
        id={fieldId}
        value={draft ?? label}
        onFocus={() => {
          setDraft(label);
          dirtyRef.current = false;
        }}
        onChange={(e) => {
          const value = e.target.value;
          setDraft(value);
          if (!value.trim()) return;
          if (!dirtyRef.current) {
            commit();
            dirtyRef.current = true;
          }
          updateNodeLabel(id, value);
        }}
        onBlur={() => setDraft(null)}
        rows={3}
        className="causal-ui mt-1.5 w-full resize-y rounded-lg border border-[var(--causal-node-border)] bg-white px-2 py-1.5 text-sm text-[var(--causal-ink)]"
      />
    </>
  );
}

export function Inspector() {
  const selectedNode = useCausalStore(
    (s) => s.nodes.find((n) => n.selected) ?? null,
  );
  const selectedEdge = useCausalStore((s) =>
    s.nodes.some((n) => n.selected)
      ? null
      : (s.edges.find((e) => e.selected) ?? null),
  );
  const updateEdge = useCausalStore((s) => s.updateEdge);
  const reverseEdge = useCausalStore((s) => s.reverseEdge);

  if (selectedNode) {
    return (
      <div className="border-t border-[var(--causal-node-border)] pt-2.5">
        <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
          選中節點
        </p>
        <NodeLabelField
          key={selectedNode.id}
          id={selectedNode.id}
          label={selectedNode.data.label}
        />
      </div>
    );
  }

  if (!selectedEdge) return null;
  const polarity = selectedEdge.data?.polarity ?? "positive";
  const bidirectional = selectedEdge.data?.bidirectional ?? false;
  return (
    <div className="border-t border-[var(--causal-node-border)] pt-2.5">
      <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
        選中連線
      </p>
      <p className="causal-mono mt-1 break-all text-[10px] text-[var(--causal-ink-muted)]">
        {selectedEdge.source} → {selectedEdge.target}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() =>
            updateEdge(selectedEdge.id, { bidirectional: !bidirectional })
          }
          className={chipClass(false, "")}
        >
          {bidirectional ? "改單向" : "改雙向"}
        </button>
        {POLARITY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => updateEdge(selectedEdge.id, { polarity: o.value })}
            className={chipClass(polarity === o.value, o.activeClass)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => reverseEdge(selectedEdge.id)}
          className={chipClass(false, "")}
        >
          反轉方向
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: toolbar.tsx**

```tsx
"use client";

import { ChevronDown, ChevronUp, Plus, SlidersHorizontal } from "lucide-react";
import { useId, useRef } from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import { Inspector } from "./inspector";
import {
  chipClass,
  modKeyLabel,
  POLARITY_OPTIONS,
  shellBtn,
  shellBtnPrimary,
} from "./ui-classes";
import type { CausalCommands } from "./use-causal-commands";
import { useStoredFlag } from "./use-stored-flag";

const LS_LEFT = "causalflow-ui-left-collapsed";
const LS_TOOLS = "causalflow-ui-tools-collapsed";

const cardClass =
  "rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md";

const detailsClass =
  "group rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] [&_summary::-webkit-details-marker]:hidden";

const summaryClass =
  "causal-ui flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium text-[var(--causal-ink)] marker:content-none";

type ToolbarProps = {
  commands: CausalCommands;
  onImportFile: () => void;
  onOpenJsonEditor: () => void;
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
};

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto min-w-0">
        <TitleCard />
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        <ToolsPanel {...props} />
      </div>
    </header>
  );
}

function TitleCard() {
  const formId = useId();
  const title = useCausalStore((s) => s.title);
  const setTitle = useCausalStore((s) => s.setTitle);
  const commit = useCausalStore((s) => s.commit);
  const dirtyRef = useRef(false);
  const [collapsed, setCollapsed] = useStoredFlag(LS_LEFT, false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="causal-ui group flex max-w-full items-center gap-2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)]/95 py-2 pl-3 pr-3 shadow-md ring-1 ring-black/[0.04] backdrop-blur-md transition hover:border-[var(--causal-accent)] hover:shadow-lg"
        aria-expanded={false}
      >
        <span className="causal-display truncate text-sm font-semibold tracking-tight text-[var(--causal-ink)]">
          CausalFlow
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--causal-ink-muted)] transition group-hover:text-[var(--causal-accent)]" />
      </button>
    );
  }

  return (
    <div className={`relative max-w-[min(100%,18rem)] p-3 ${cardClass}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="causal-display text-lg leading-tight tracking-tight text-[var(--causal-ink)]">
            CausalFlow
          </h1>
          <p className="causal-ui mt-1 text-[11px] leading-snug text-[var(--causal-ink-muted)]">
            因果圖 · 自動存檔 · 按 ? 看快捷鍵
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="causal-ui -mr-0.5 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]"
          aria-label="收合標題區"
          title="收合"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
      <label htmlFor={`${formId}-title`} className="sr-only">
        圖標題
      </label>
      <input
        id={`${formId}-title`}
        value={title}
        onFocus={() => {
          dirtyRef.current = false;
        }}
        onChange={(e) => {
          if (!dirtyRef.current) {
            commit();
            dirtyRef.current = true;
          }
          setTitle(e.target.value);
        }}
        placeholder="圖標題（可選）"
        className="causal-ui mt-2.5 w-full rounded-lg border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] px-2.5 py-1.5 text-sm text-[var(--causal-ink)] placeholder:text-[var(--causal-ink-muted)]"
      />
    </div>
  );
}

function ToolsPanel({
  commands,
  onImportFile,
  onOpenJsonEditor,
  onOpenPalette,
  onOpenShortcuts,
}: ToolbarProps) {
  const [collapsed, setCollapsed] = useStoredFlag(LS_TOOLS, false);
  const layoutDirection = useCausalStore((s) => s.layoutDirection);
  const canUndo = useCausalStore((s) => s.history.past.length > 0);
  const canRedo = useCausalStore((s) => s.history.future.length > 0);
  const exporting = useCausalStore((s) => s.exporting);
  const defaultPolarity = useCausalStore((s) => s.defaultPolarity);
  const defaultBidirectional = useCausalStore((s) => s.defaultBidirectional);
  const setDefaultPolarity = useCausalStore((s) => s.setDefaultPolarity);
  const setDefaultBidirectional = useCausalStore(
    (s) => s.setDefaultBidirectional,
  );
  const mod = modKeyLabel();

  if (collapsed) {
    return (
      <div className={`flex flex-col gap-1.5 p-1.5 ${cardClass}`}>
        <button
          type="button"
          onClick={commands.addNodeAtCenter}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--causal-accent)] text-white shadow-sm transition hover:opacity-90"
          title="新增節點"
          aria-label="新增節點"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--causal-node-border)] bg-[var(--causal-paper-2)] text-[var(--causal-ink)] transition hover:bg-black/[0.05]"
          title="展開工具"
          aria-expanded={false}
          aria-label="展開工具"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className={`w-[min(calc(100vw-1.5rem),17.5rem)] ${cardClass}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2">
        <span className="causal-ui text-xs font-medium tracking-wide text-[var(--causal-ink-muted)]">
          工具
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="causal-ui flex h-8 w-8 items-center justify-center rounded-lg text-[var(--causal-ink-muted)] transition hover:bg-black/[0.05] hover:text-[var(--causal-ink)]"
          aria-label="收合工具列"
          title="收合"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(70vh,calc(100dvh-8rem))] space-y-2.5 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={commands.addNodeAtCenter} className={shellBtnPrimary}>
            新增節點
          </button>
          <button type="button" onClick={commands.autoLayout} className={shellBtn} title={`${mod}+L`}>
            一鍵排版
          </button>
          <button
            type="button"
            onClick={commands.toggleOrientation}
            title={
              layoutDirection === "LR"
                ? "橫式版面：改為直式並重新排版"
                : "直式版面：改為橫式並重新排版"
            }
            className={shellBtn}
          >
            {layoutDirection === "LR" ? "切直式" : "切橫式"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={!canUndo} onClick={commands.undo} className={shellBtn} title={`${mod}+Z`}>
            復原
          </button>
          <button type="button" disabled={!canRedo} onClick={commands.redo} className={shellBtn} title={`${mod}+Shift+Z`}>
            重做
          </button>
          <button type="button" onClick={commands.newBlank} className={shellBtn}>
            新空白圖
          </button>
          {onOpenPalette && (
            <button type="button" onClick={onOpenPalette} className={shellBtn}>
              命令 {mod}K
            </button>
          )}
          {onOpenShortcuts && (
            <button type="button" onClick={onOpenShortcuts} className={shellBtn}>
              快捷鍵 ?
            </button>
          )}
        </div>

        <details open className={detailsClass}>
          <summary className={summaryClass}>
            <span>匯入／匯出 JSON</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
            <button type="button" onClick={onImportFile} className={shellBtn}>
              匯入 JSON
            </button>
            <button type="button" onClick={commands.exportJson} className={shellBtn}>
              匯出 JSON
            </button>
            <button type="button" onClick={onOpenJsonEditor} className={shellBtn}>
              查看／編輯 JSON
            </button>
          </div>
        </details>

        <details open className={detailsClass}>
          <summary className={summaryClass}>
            <span>匯出圖檔</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--causal-ink-muted)] transition group-open:rotate-180" />
          </summary>
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--causal-node-border)] px-2.5 pb-2.5 pt-2">
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("png")} className={shellBtn}>
              匯出 PNG 圖檔
            </button>
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("pdf", "portrait")} className={shellBtn}>
              匯出 PDF（直式 A4）
            </button>
            <button type="button" disabled={exporting} onClick={() => void commands.exportImage("pdf", "landscape")} className={shellBtn}>
              匯出 PDF（橫式 A4）
            </button>
          </div>
        </details>

        <div>
          <p className="causal-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--causal-ink-muted)]">
            新連線預設
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setDefaultBidirectional(false)}
              className={chipClass(!defaultBidirectional, "bg-[var(--causal-accent-muted)]")}
            >
              單向
            </button>
            <button
              type="button"
              onClick={() => setDefaultBidirectional(true)}
              className={chipClass(defaultBidirectional, "bg-[var(--causal-accent-muted)]")}
            >
              雙向
            </button>
            {POLARITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDefaultPolarity(o.value)}
                className={chipClass(defaultPolarity === o.value, o.activeClass)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <Inspector />
      </div>
    </aside>
  );
}
```

- [ ] **Step 7: json-editor-dialog.tsx**

由舊 `causal-flow-app.tsx` 的 JSON 編輯器搬出，並修掉一個既有 bug：`parseCausalJson` 會把 `SyntaxError` 包成 `CausalJsonError("不是有效的 JSON")`，所以舊的行列號提示永遠不會出現。這裡先自己 `JSON.parse` 一次取得語法錯誤位置。

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  CAUSAL_JSON_AI_GUIDE,
  CausalJsonError,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { useCausalStore } from "@/lib/store/causal-store";
import { shellBtn, shellBtnPrimary } from "./ui-classes";
import type { CausalCommands } from "./use-causal-commands";

function toLineCol(text: string, index: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < safe; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/** 純語法檢查；回傳帶行列號的訊息，語法正確則回 null */
function jsonSyntaxError(raw: string): string | null {
  try {
    JSON.parse(raw);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON 語法錯誤";
    const match = /position\s+(\d+)/i.exec(message);
    if (!match) return `JSON 語法錯誤：${message}`;
    const pos = Number(match[1]);
    const { line, column } = toLineCol(raw, pos);
    return `JSON 語法錯誤：第 ${line} 行，第 ${column} 列（字元位置 ${pos}）`;
  }
}

export function JsonEditorDialog({
  commands,
  onClose,
}: {
  commands: CausalCommands;
  onClose: () => void;
}) {
  const showToast = useCausalStore((s) => s.showToast);
  const [text, setText] = useState(() => commands.currentJson());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fail = (message: string) => {
    setError(message);
    showToast(message);
  };

  const apply = () => {
    const syntax = jsonSyntaxError(text);
    if (syntax) return fail(syntax);
    const err = commands.importText(text);
    if (err) return fail(err);
    showToast("已套用 JSON 變更");
    onClose();
  };

  const format = () => {
    const syntax = jsonSyntaxError(text);
    if (syntax) return fail(syntax);
    try {
      setText(stringifyCausalJson(parseCausalJson(text)));
      setError(null);
      showToast("已自動格式化 JSON");
    } catch (err) {
      fail(err instanceof CausalJsonError ? err.message : "JSON 格式化失敗");
    }
  };

  const copyErrorWithGuide = async () => {
    if (!error) return;
    const payload = [
      "請協助修復以下 CausalFlow JSON 錯誤：",
      `錯誤訊息：${error}`,
      "",
      CAUSAL_JSON_AI_GUIDE,
      "",
      "目前 JSON 內容：",
      text,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      showToast("已複製錯誤訊息與 JSON 規則");
    } catch {
      showToast("複製失敗，請手動複製錯誤訊息與 JSON");
    }
  };

  return (
    <div
      className="causal-ui absolute inset-0 z-[110] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="JSON 編輯器"
        className="flex h-[90dvh] w-[90vw] max-w-none flex-col rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--causal-ink)]">JSON 編輯器</h2>
          <button type="button" onClick={onClose} className={shellBtn}>
            關閉
          </button>
        </header>
        <div className="min-h-0 flex-1 p-3">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            className="causal-mono h-full w-full resize-none rounded-lg border border-[var(--causal-node-border)] bg-white px-3 py-2 text-xs leading-6 text-[var(--causal-ink)]"
            spellCheck={false}
          />
          {error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              <p>{error}</p>
              <p className="mt-1 text-[11px] text-red-600">
                若不確定如何修復，可將錯誤訊息貼給 AI。
              </p>
              <button
                type="button"
                onClick={() => void copyErrorWithGuide()}
                className="mt-2 rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-100"
              >
                複製錯誤訊息＋JSON 規則給 AI
              </button>
            </div>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--causal-node-border)] px-3 py-2.5">
          <button type="button" onClick={format} className={shellBtn}>
            自動格式化 JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setText(commands.currentJson());
              setError(null);
            }}
            className={shellBtn}
          >
            重新載入目前 JSON
          </button>
          <button type="button" onClick={apply} className={shellBtnPrimary}>
            套用變更
          </button>
        </footer>
      </section>
    </div>
  );
}
```

- [ ] **Step 8: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: 全部通過。若 lint 對 `react-hooks/*` 報錯，依訊息修正（不得用 eslint-disable 掩蓋）。

- [ ] **Step 9: Commit**

```bash
git add components/causal/ui-classes.ts components/causal/use-stored-flag.ts components/causal/use-autosave.ts components/causal/use-causal-commands.ts components/causal/inspector.tsx components/causal/toolbar.tsx components/causal/json-editor-dialog.tsx
git commit -m "feat(causal): add commands, autosave, toolbar, inspector, JSON editor modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 接上 store＋inline 編輯＋畫布滑鼠操作

**Files:**
- Modify: `components/causal/causal-node.tsx`
- Rewrite: `components/causal/causal-flow-app.tsx`

**Interfaces:**
- Consumes: Task 7 store、Task 8 所有模組
- Produces: `FlowCanvas` 的結構（Task 13 會在其上加快捷鍵／右鍵／命令面板）

- [ ] **Step 1: causal-node.tsx 加 inline 編輯**

整檔替換為：

```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useCausalStore } from "@/lib/store/causal-store";
import { useCausalFlowOrientation } from "./causal-orientation-context";

export type CausalNodeData = {
  label: string;
};

function NodeLabelEditor({ initial }: { initial: string }) {
  const finishEditing = useCausalStore((s) => s.finishEditing);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={initial}
      rows={1}
      aria-label="節點文字"
      className="nodrag nopan nowheel causal-ui block w-full min-w-[6rem] resize-none bg-transparent text-center text-[0.95rem] leading-snug text-[var(--causal-ink)] outline-none [field-sizing:content]"
      onKeyDown={(e) => {
        // 中文輸入法選字時的 Enter 不算確認
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finishEditing(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finishEditing(null);
        }
      }}
      onBlur={(e) => finishEditing(e.currentTarget.value)}
    />
  );
}

export function CausalNode({
  id,
  data,
  selected,
}: NodeProps<Node<CausalNodeData, "causal">>) {
  const orientation = useCausalFlowOrientation();
  const updateNodeInternals = useUpdateNodeInternals();
  const editing = useCausalStore((s) => s.editing?.id === id);
  const targetPos =
    orientation === "horizontal" ? Position.Left : Position.Top;
  const sourcePos =
    orientation === "horizontal" ? Position.Right : Position.Bottom;

  /** Handle 位置變更後通知 React Flow 重算連線端點，否則邊仍沿用舊的左右座標 */
  useLayoutEffect(() => {
    updateNodeInternals(id);
  }, [id, orientation, updateNodeInternals]);

  return (
    <div
      className={[
        "causal-node min-w-[7rem] max-w-[14rem] rounded-lg border-2 bg-white px-4 py-3 text-center shadow-sm transition-[box-shadow,transform]",
        selected || editing
          ? "border-[var(--causal-accent)] shadow-[0_0_0_3px_var(--causal-accent-muted)]"
          : "border-[var(--causal-node-border)]",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={targetPos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
      {editing ? (
        <NodeLabelEditor initial={data.label} />
      ) : (
        <p className="causal-ui whitespace-pre-wrap text-[0.95rem] leading-snug text-[var(--causal-ink)]">
          {data.label}
        </p>
      )}
      <Handle
        type="source"
        position={sourcePos}
        className="!h-2.5 !w-2.5 !border-2 !border-[var(--causal-handle)] !bg-white"
      />
    </div>
  );
}
```

- [ ] **Step 2: 重寫 causal-flow-app.tsx**

整檔替換為：

```tsx
"use client";

import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MiniMap,
  type OnConnectEnd,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Map as MapIcon } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useCausalStore } from "@/lib/store/causal-store";
import { CausalEdge } from "./causal-edge";
import { CausalNode } from "./causal-node";
import { CausalOrientationProvider } from "./causal-orientation-context";
import { JsonEditorDialog } from "./json-editor-dialog";
import { JsonGuidePanel } from "./json-guide-panel";
import { Toolbar } from "./toolbar";
import { hydrateFromStorage, useAutosave } from "./use-autosave";
import { useCausalCommands } from "./use-causal-commands";
import { useStoredFlag } from "./use-stored-flag";

const nodeTypes = { causal: CausalNode };
const edgeTypes = { causal: CausalEdge };
const LS_MINIMAP = "causalflow-ui-minimap-hidden";

function clientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("changedTouches" in event) {
    const t = event.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function isPaneTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.classList.contains("react-flow__pane")
  );
}

function FlowCanvas() {
  useAutosave();
  const nodes = useCausalStore((s) => s.nodes);
  const edges = useCausalStore((s) => s.edges);
  const layoutDirection = useCausalStore((s) => s.layoutDirection);
  const toast = useCausalStore((s) => s.toast);
  const onNodesChange = useCausalStore((s) => s.onNodesChange);
  const onEdgesChange = useCausalStore((s) => s.onEdgesChange);
  const connect = useCausalStore((s) => s.connect);
  const commit = useCausalStore((s) => s.commit);
  const showToast = useCausalStore((s) => s.showToast);

  const flowWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commands = useCausalCommands(flowWrapRef);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [minimapHidden, setMinimapHidden] = useStoredFlag(LS_MINIMAP, false);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || !state.fromNode || !isPaneTarget(event.target)) {
        return;
      }
      commands.addConnectedNodeAtScreen(
        state.fromNode.id,
        clientPoint(event),
        state.fromHandle?.type === "target" ? "upstream" : "downstream",
      );
    },
    [commands],
  );

  const onWrapperDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if (!isPaneTarget(e.target)) return;
      commands.addNodeAtScreen({ x: e.clientX, y: e.clientY });
    },
    [commands],
  );

  const onFile = async (file: File | null) => {
    if (!file) return;
    const err = commands.importText(await file.text());
    showToast(err ?? "已匯入 JSON");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative h-[100dvh] w-full">
      <CausalOrientationProvider
        orientation={layoutDirection === "LR" ? "horizontal" : "vertical"}
      >
        <div
          ref={flowWrapRef}
          className="h-full w-full min-h-0"
          onDoubleClick={onWrapperDoubleClick}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(c) => {
              if (c.source && c.target) connect(c.source, c.target);
            }}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={() => commit()}
            onSelectionDragStart={() => commit()}
            onBeforeDelete={async ({ nodes: ns, edges: es }) => {
              if (ns.length > 0 || es.length > 0) commit();
              return true;
            }}
            onNodeDoubleClick={(_, node) => commands.editNode(node.id)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.35}
            maxZoom={1.6}
            zoomOnDoubleClick={false}
            deleteKeyCode={["Backspace", "Delete"]}
            panActivationKeyCode={null}
            disableKeyboardA11y
            className="!bg-transparent"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.1}
              color="var(--causal-dot)"
            />
            <Controls
              className="!border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md [&_button]:!fill-[var(--causal-ink)]"
              showInteractive={false}
            >
              <ControlButton
                onClick={() => setMinimapHidden(!minimapHidden)}
                title={minimapHidden ? "顯示小地圖" : "隱藏小地圖"}
                aria-label={minimapHidden ? "顯示小地圖" : "隱藏小地圖"}
              >
                <MapIcon />
              </ControlButton>
            </Controls>
            {!minimapHidden && (
              <MiniMap
                position="bottom-left"
                style={{ marginLeft: 56 }}
                pannable
                zoomable
                nodeColor="#ffffff"
                nodeStrokeColor="#c9bda8"
                maskColor="rgba(232, 223, 210, 0.65)"
                className="!border !border-[var(--causal-node-border)] !bg-[var(--causal-paper)] !shadow-md"
              />
            )}
          </ReactFlow>
        </div>
      </CausalOrientationProvider>

      <Toolbar
        commands={commands}
        onImportFile={() => fileInputRef.current?.click()}
        onOpenJsonEditor={() => setJsonEditorOpen(true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {jsonEditorOpen && (
        <JsonEditorDialog
          commands={commands}
          onClose={() => setJsonEditorOpen(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="causal-ui absolute bottom-20 left-1/2 z-[101] -translate-x-1/2 rounded-full border border-[var(--causal-node-border)] bg-[var(--causal-paper)] px-4 py-2 text-sm text-[var(--causal-ink)] shadow-lg"
        >
          {toast}
        </div>
      )}

      <JsonGuidePanel />
    </div>
  );
}

export function CausalFlowApp() {
  // 整個 app 只在 client 端渲染（causal-page-loader 使用 ssr:false），可同步讀 localStorage
  useState(hydrateFromStorage);
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
```

`JsonEditorDialog` 的 `onClose` 會被放進 effect 依賴；傳入的是每次 render 新建的 arrow function，會讓 keydown listener 每次重綁。可接受（只在 dialog 開啟時存在）。若 lint 報錯，把 onClose 用 `useCallback` 包起來。

- [ ] **Step 3: 靜態驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`
Expected: 全部通過

- [ ] **Step 4: UI 冒煙測試（ego-browser）**

用 Bash `run_in_background: true` 啟動 `pnpm dev`，以 ego-browser 開 `http://localhost:3000`，逐項確認：
1. 首次載入顯示範例圖。
2. 雙擊空白處 → 出現新節點且文字被選取；輸入「測試」按 Enter → 節點顯示「測試」。
3. 重新整理頁面 → 「測試」節點仍在（自動存檔）。
4. 按工具列「復原」→「測試」節點文字變回「新節點」；再按「復原」→ 節點消失；「重做」兩次 → 回來。
5. 雙擊既有節點 → 編輯；按 Esc → 文字不變。
6. 雙擊空白建立節點後直接按 Esc → 節點消失，「復原」按鈕可用狀態與建立前一致。
7. 從節點右側 handle 拖線到空白放開 → 建立新節點、已連線、進入編輯。
8. 拖曳節點後按「復原」→ 回到原位。
9. 選取節點按 Delete → 刪除；按「復原」→ 回來。
10. Controls 的地圖按鈕可切換 MiniMap，且重新整理後維持狀態。
11. 「切直式」、「一鍵排版」、匯出 PNG、匯出 PDF 直式仍正常；匯出後畫面方向與節點位置恢復。
12. 「查看／編輯 JSON」：刪掉一個逗號按「套用變更」→ 錯誤訊息含「第 N 行，第 M 列」。
13. 「新空白圖」→ 清空並 toast；「復原」→ 回來。

結束後停止 dev server。任何一項失敗：修正後重跑步驟 3、4。

- [ ] **Step 5: Commit**

```bash
git add components/causal/causal-node.tsx components/causal/causal-flow-app.tsx
git commit -m "feat(causal): wire canvas to store with autosave, undo, inline editing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 快捷鍵與剪貼簿事件

**Files:**
- Create: `components/causal/use-hotkeys.ts`

**Interfaces:**
- Consumes: `CausalCommands`
- Produces: `useHotkeys(commands: CausalCommands, ui: { openPalette: () => void; openShortcuts: () => void }): void`

- [ ] **Step 1: 實作**

`components/causal/use-hotkeys.ts`：

```ts
"use client";

import { useEffect } from "react";
import {
  type CausalJsonDocument,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import type { ArrowDirection } from "@/lib/navigation";
import type { CausalCommands } from "./use-causal-commands";

const ARROWS: Record<string, ArrowDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * 正在打字、焦點在按鈕／連結（Enter、Space 屬於它們）、或在對話框／選單內時，全域快捷鍵一律讓路。
 * 點畫布會把焦點移回 body，所以不影響畫布上的操作。
 */
function isOwnedByOtherUi(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'input, textarea, select, button, a[href], summary, [contenteditable="true"], [role="dialog"], [role="menu"]',
    ) !== null
  );
}

export function useHotkeys(
  commands: CausalCommands,
  ui: { openPalette: () => void; openShortcuts: () => void },
): void {
  const { openPalette, openShortcuts } = ui;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || isOwnedByOtherUi(e.target)) return;

      // 對「有做事才攔截」的鍵：handler 回傳 true 才 preventDefault
      const consume = (handled: boolean) => {
        if (handled) e.preventDefault();
      };

      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === "z" && e.shiftKey) return consume((commands.redo(), true));
        if (key === "z") return consume((commands.undo(), true));
        if (key === "y") return consume((commands.redo(), true));
        if (key === "k") return consume((openPalette(), true));
        if (key === "l") return consume((commands.autoLayout(), true));
        if (key === "d") return consume((commands.duplicate(), true));
        if (key === "a") return consume((commands.selectAll(), true));
        return;
      }
      if (e.altKey) return;

      if (e.key === "?") return consume((openShortcuts(), true));
      if (e.key === "Escape") return commands.clearSelection();
      if (e.key === "Tab" && !e.shiftKey) return consume(commands.createDownstream());
      if (e.key === "Enter") return consume(commands.createSibling());
      if (e.key === "F2" || e.key === " ") return consume(commands.editSelected());

      const arrow = ARROWS[e.key];
      if (arrow) return consume(commands.navigate(arrow));

      if (e.key === "+" || e.key === "=") {
        return consume(commands.setSelectedEdgePolarity("positive"));
      }
      if (e.key === "-") return consume(commands.setSelectedEdgePolarity("negative"));
      if (e.key === "0") return consume(commands.setSelectedEdgePolarity("neutral"));
      if (e.key.toLowerCase() === "b") {
        return consume(commands.toggleSelectedEdgeDirection());
      }
    };

    // 走原生剪貼簿事件：讀取不需權限詢問，且可跨分頁貼上 CausalFlow JSON
    const onCopy = (e: ClipboardEvent) => {
      if (isOwnedByOtherUi(e.target)) return;
      const frag = commands.copySelection();
      if (!frag || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", stringifyCausalJson(frag));
    };

    const onCut = (e: ClipboardEvent) => {
      if (isOwnedByOtherUi(e.target)) return;
      const frag = commands.copySelection();
      if (!frag || !e.clipboardData) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", stringifyCausalJson(frag));
      commands.deleteSelected();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isOwnedByOtherUi(e.target)) return;
      let doc: CausalJsonDocument | null = null;
      try {
        doc = parseCausalJson(e.clipboardData?.getData("text/plain") ?? "");
      } catch {
        doc = null;
      }
      if (commands.pasteDocument(doc)) e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [commands, openPalette, openShortcuts]);
}
```

註：`consume((fn(), true))` 是逗號運算式：先執行再回傳 true。若 lint 規則 `no-sequences` 報錯，改寫成：

```ts
if (key === "z" && e.shiftKey) { e.preventDefault(); commands.redo(); return; }
```

並對其他無回傳值的分支套用同樣寫法。

- [ ] **Step 2: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 通過

- [ ] **Step 3: Commit**

```bash
git add components/causal/use-hotkeys.ts
git commit -m "feat(causal): add keyboard shortcuts and clipboard event handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 右鍵選單

**Files:**
- Create: `components/causal/canvas-context-menu.tsx`

**Interfaces:**
- Consumes: `CausalCommands`、`hasInternalClipboard`、`@/components/ui/context-menu`
- Produces:
  - `type MenuTarget = { kind: "node" } | { kind: "edge" } | { kind: "selection" } | { kind: "pane"; screen: { x: number; y: number } }`
  - `<CanvasContextMenu target commands>{children}</CanvasContextMenu>`——children 必須是單一可接 ref 的 DOM 元素（以 `asChild` 當 trigger）

右鍵目標的選取由呼叫端（Task 13）在 React Flow 的 `onNodeContextMenu` 等事件中完成；本元件只依 `target.kind` 決定選單內容，指令一律作用在「目前選取」。React Flow 的 handler **不可** 呼叫 `event.preventDefault()`，否則 Radix 的 trigger 不會開啟選單。

- [ ] **Step 1: 實作**

`components/causal/canvas-context-menu.tsx`：

```tsx
"use client";

import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { modKeyLabel } from "./ui-classes";
import { type CausalCommands, hasInternalClipboard } from "./use-causal-commands";

export type MenuTarget =
  | { kind: "node" }
  | { kind: "edge" }
  | { kind: "selection" }
  | { kind: "pane"; screen: { x: number; y: number } };

function SelectionItems({ commands }: { commands: CausalCommands }) {
  const mod = modKeyLabel();
  return (
    <>
      <ContextMenuItem onSelect={commands.copyToSystemClipboard}>
        複製
        <ContextMenuShortcut>{mod}C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={commands.duplicate}>
        建立副本
        <ContextMenuShortcut>{mod}D</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={commands.deleteSelected}>
        刪除
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </>
  );
}

function MenuItems({
  target,
  commands,
}: {
  target: MenuTarget;
  commands: CausalCommands;
}) {
  const mod = modKeyLabel();
  switch (target.kind) {
    case "node":
      return (
        <>
          <ContextMenuItem onSelect={() => commands.editSelected()}>
            編輯文字
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.createDownstream()}>
            建立下游節點
            <ContextMenuShortcut>Tab</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.createSibling()}>
            建立同層節點
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <SelectionItems commands={commands} />
        </>
      );
    case "selection":
      return <SelectionItems commands={commands} />;
    case "edge":
      return (
        <>
          <ContextMenuItem onSelect={() => commands.setSelectedEdgePolarity("positive")}>
            正相關
            <ContextMenuShortcut>+</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.setSelectedEdgePolarity("negative")}>
            負相關
            <ContextMenuShortcut>-</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.setSelectedEdgePolarity("neutral")}>
            未指定
            <ContextMenuShortcut>0</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => commands.toggleSelectedEdgeDirection()}>
            切換單／雙向
            <ContextMenuShortcut>B</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={commands.reverseSelectedEdge}>
            反轉方向
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={commands.deleteSelected}>
            刪除
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      );
    case "pane":
      return (
        <>
          <ContextMenuItem onSelect={() => commands.addNodeAtScreen(target.screen)}>
            在此新增節點
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!hasInternalClipboard()}
            onSelect={() => commands.pasteDocument(null, target.screen)}
          >
            貼上
            <ContextMenuShortcut>{mod}V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={commands.autoLayout}>
            一鍵排版
            <ContextMenuShortcut>{mod}L</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={commands.selectAll}>
            全選
            <ContextMenuShortcut>{mod}A</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      );
  }
}

export function CanvasContextMenu({
  target,
  commands,
  children,
}: {
  target: MenuTarget | null;
  commands: CausalCommands;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {target && (
        <ContextMenuContent className="causal-ui w-52">
          <MenuItems target={target} commands={commands} />
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
```

先讀 `components/ui/context-menu.tsx` 確認 `ContextMenuItem` 是否有 `variant` prop；若沒有，移除 `variant="destructive"`，改用 `className="text-destructive"`。

- [ ] **Step 2: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 通過

- [ ] **Step 3: Commit**

```bash
git add components/causal/canvas-context-menu.tsx
git commit -m "feat(causal): add canvas context menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 命令面板與快捷鍵一覽

**Files:**
- Create: `components/causal/command-palette.tsx`
- Create: `components/causal/shortcuts-dialog.tsx`

**Interfaces:**
- Consumes: `CausalCommands`、`@/components/ui/command`、`@/components/ui/dialog`、`@/components/ui/kbd`
- Produces:
  - `type PaletteAction = { id: string; label: string; shortcut?: string; run: () => void }`
  - `<CommandPalette open onOpenChange actions onFocusNode />`
  - `<ShortcutsDialog open onOpenChange />`

- [ ] **Step 1: 確認 shadcn CommandDialog 結構**

讀 `components/ui/command.tsx` 的 `CommandDialog`。在本專案版本中它**不會**自動包 `<Command>`，children 需自己放 `<Command>`。如果你讀到的版本會自己包，下面程式碼中的 `<Command>` 那一層要拿掉。

- [ ] **Step 2: command-palette.tsx**

```tsx
"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useCausalStore } from "@/lib/store/causal-store";

export type PaletteAction = {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  onFocusNode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
  onFocusNode: (id: string) => void;
}) {
  const nodes = useCausalStore((s) => s.nodes);

  const choose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="命令面板"
      description="搜尋動作或節點"
    >
      <Command className="causal-ui">
        <CommandInput placeholder="輸入動作或節點文字…" />
        <CommandList>
          <CommandEmpty>找不到符合的項目</CommandEmpty>
          <CommandGroup heading="動作">
            {actions.map((a) => (
              <CommandItem
                key={a.id}
                value={`action ${a.label}`}
                onSelect={() => choose(a.run)}
              >
                {a.label}
                {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
          {nodes.length > 0 && (
            <CommandGroup heading="節點">
              {nodes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={`node ${n.id} ${n.data.label}`}
                  onSelect={() => choose(() => onFocusNode(n.id))}
                >
                  {n.data.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
```

- [ ] **Step 3: shortcuts-dialog.tsx**

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { modKeyLabel } from "./ui-classes";

type Row = { keys: string[][]; label: string };

function rows(mod: string): { group: string; items: Row[] }[] {
  return [
    {
      group: "建立與編輯",
      items: [
        { keys: [["Tab"]], label: "建立下游節點" },
        { keys: [["Enter"]], label: "建立同層節點" },
        { keys: [["F2"], ["Space"]], label: "編輯選取節點" },
        { keys: [["雙擊"]], label: "編輯節點／在空白處新增" },
        { keys: [["Enter"]], label: "編輯中：確認（Shift+Enter 換行）" },
        { keys: [["Esc"]], label: "編輯中：取消" },
      ],
    },
    {
      group: "選取與移動",
      items: [
        { keys: [["↑"], ["↓"], ["←"], ["→"]], label: "選取該方向最近的節點" },
        { keys: [[mod, "A"]], label: "全選" },
        { keys: [["Shift", "拖曳"]], label: "框選" },
        { keys: [["Esc"]], label: "取消選取" },
      ],
    },
    {
      group: "連線（選取一條連線時）",
      items: [
        { keys: [["+"]], label: "正相關" },
        { keys: [["-"]], label: "負相關" },
        { keys: [["0"]], label: "未指定" },
        { keys: [["B"]], label: "切換單／雙向" },
      ],
    },
    {
      group: "編輯操作",
      items: [
        { keys: [[mod, "Z"]], label: "復原" },
        { keys: [[mod, "Shift", "Z"], ["Ctrl", "Y"]], label: "重做" },
        { keys: [[mod, "C"]], label: "複製" },
        { keys: [[mod, "X"]], label: "剪下" },
        { keys: [[mod, "V"]], label: "貼上" },
        { keys: [[mod, "D"]], label: "建立副本" },
        { keys: [["Delete"], ["Backspace"]], label: "刪除" },
      ],
    },
    {
      group: "其他",
      items: [
        { keys: [[mod, "K"]], label: "命令面板（含節點搜尋）" },
        { keys: [[mod, "L"]], label: "一鍵排版" },
        { keys: [["?"]], label: "顯示本說明" },
      ],
    },
  ];
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mod = modKeyLabel();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="causal-ui max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>快捷鍵</DialogTitle>
          <DialogDescription>焦點在輸入框時，快捷鍵不會作用。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {rows(mod).map((section) => (
            <section key={section.group}>
              <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {section.group}
              </h3>
              <ul className="space-y-1">
                {section.items.map((row) => (
                  <li
                    key={`${section.group}-${row.label}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {row.keys.map((combo) => (
                        <KbdGroup key={combo.join("+")}>
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </KbdGroup>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: 驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 通過

- [ ] **Step 5: Commit**

```bash
git add components/causal/command-palette.tsx components/causal/shortcuts-dialog.tsx
git commit -m "feat(causal): add command palette and shortcuts dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 整合快捷鍵、右鍵選單、命令面板

**Files:**
- Modify: `components/causal/causal-flow-app.tsx`

**Interfaces:**
- Consumes: Task 10–12 的 `useHotkeys`、`CanvasContextMenu`／`MenuTarget`、`CommandPalette`／`PaletteAction`、`ShortcutsDialog`

- [ ] **Step 1: 加 import**

在 `causal-flow-app.tsx` 既有 import 區加入：

```tsx
import { useMemo } from "react";
import { CanvasContextMenu, type MenuTarget } from "./canvas-context-menu";
import { CommandPalette, type PaletteAction } from "./command-palette";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { modKeyLabel } from "./ui-classes";
import { useHotkeys } from "./use-hotkeys";
```

（`useMemo` 併入既有的 `from "react"` import，不要重複 import。）

- [ ] **Step 2: FlowCanvas 內加狀態與快捷鍵**

在 `const [minimapHidden, setMinimapHidden] = ...` 之後加入：

```tsx
  const selectNodes = useCausalStore((s) => s.selectNodes);
  const selectEdge = useCausalStore((s) => s.selectEdge);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useHotkeys(commands, { openPalette, openShortcuts });

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const mod = modKeyLabel();
    return [
      { id: "add", label: "新增節點", run: commands.addNodeAtCenter },
      { id: "layout", label: "一鍵排版", shortcut: `${mod}L`, run: commands.autoLayout },
      { id: "orientation", label: "切換橫式／直式", run: commands.toggleOrientation },
      { id: "undo", label: "復原", shortcut: `${mod}Z`, run: commands.undo },
      { id: "redo", label: "重做", shortcut: `${mod}⇧Z`, run: commands.redo },
      { id: "import", label: "匯入 JSON", run: () => fileInputRef.current?.click() },
      { id: "export-json", label: "匯出 JSON", run: commands.exportJson },
      { id: "edit-json", label: "查看／編輯 JSON", run: () => setJsonEditorOpen(true) },
      { id: "export-png", label: "匯出 PNG", run: () => void commands.exportImage("png") },
      { id: "export-pdf-p", label: "匯出 PDF（直式 A4）", run: () => void commands.exportImage("pdf", "portrait") },
      { id: "export-pdf-l", label: "匯出 PDF（橫式 A4）", run: () => void commands.exportImage("pdf", "landscape") },
      { id: "blank", label: "新空白圖", run: commands.newBlank },
      { id: "shortcuts", label: "快捷鍵一覽", shortcut: "?", run: openShortcuts },
    ];
  }, [commands, openShortcuts]);
```

- [ ] **Step 3: 用 CanvasContextMenu 包住畫布 wrapper，並加右鍵事件**

把：

```tsx
        <div
          ref={flowWrapRef}
          className="h-full w-full min-h-0"
          onDoubleClick={onWrapperDoubleClick}
        >
```

改為：

```tsx
        <CanvasContextMenu target={menuTarget} commands={commands}>
        <div
          ref={flowWrapRef}
          className="h-full w-full min-h-0"
          onDoubleClick={onWrapperDoubleClick}
        >
```

並把對應的結尾 `</div>`（緊接在 `</ReactFlow>` 之後那個）改為：

```tsx
        </div>
        </CanvasContextMenu>
```

在 `<ReactFlow` 的 props 中（`onNodeDoubleClick` 之後）加入。注意：這些 handler 都**不可**呼叫 `preventDefault()`。

```tsx
            onNodeContextMenu={(_, node) => {
              if (!node.selected) selectNodes([node.id]);
              setMenuTarget(
                nodes.filter((n) => n.selected).length > 1 && node.selected
                  ? { kind: "selection" }
                  : { kind: "node" },
              );
            }}
            onSelectionContextMenu={() => setMenuTarget({ kind: "selection" })}
            onEdgeContextMenu={(_, edge) => {
              selectEdge(edge.id);
              setMenuTarget({ kind: "edge" });
            }}
            onPaneContextMenu={(e) =>
              setMenuTarget({ kind: "pane", screen: { x: e.clientX, y: e.clientY } })
            }
```

- [ ] **Step 4: Toolbar 傳入開啟函式，並渲染面板與說明**

把 `<Toolbar ... />` 改為：

```tsx
      <Toolbar
        commands={commands}
        onImportFile={() => fileInputRef.current?.click()}
        onOpenJsonEditor={() => setJsonEditorOpen(true)}
        onOpenPalette={openPalette}
        onOpenShortcuts={openShortcuts}
      />
```

在 `{jsonEditorOpen && ...}` 區塊之後加入：

```tsx
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={paletteActions}
        onFocusNode={commands.focusNode}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
```

- [ ] **Step 5: 靜態驗證**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`
Expected: 全部通過

- [ ] **Step 6: Commit**

```bash
git add components/causal/causal-flow-app.tsx
git commit -m "feat(causal): wire hotkeys, context menu and command palette

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: UI 驗收（ego-browser）＋ README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 啟動 dev server**

Bash `run_in_background: true`：`pnpm dev`。以 ego-browser 開 `http://localhost:3000`。先在 devtools console 執行 `localStorage.clear()` 再重新整理，從範例圖開始。

- [ ] **Step 2: 逐項驗收**

每一項記錄「通過／失敗＋現象」：

鍵盤流：
1. 點「降雨」→ Tab → 右側出現「新節點」（已選取文字、已連線 降雨→新）；打「積水」Enter。
2. 接著 Enter → 「積水」下方出現同層節點，上游為「降雨」；Esc → 節點消失。
3. 選「路面溼滑」→ 方向鍵 ↓ → 選取移到「車流速度」；← → 回到「降雨」。
4. F2 → 進入編輯；Esc → 不變。Space 同樣進入編輯。
5. 切直式後 Tab → 新節點出現在下方。
6. 打字中按 Tab／方向鍵 → 只影響輸入框，不建立節點。點完工具列按鈕後再點畫布節點，Tab 仍可建立下游節點。

連線：
7. 點一條連線 → 按 `-` → 變負（虛線紅）；`0` → 未指定；`+` → 正；`B` → 雙向箭頭。
8. 右鍵連線 → 選單含 正／負／未指定／切換單雙向／反轉方向／刪除；「反轉方向」生效。

右鍵：
9. 右鍵節點 → 「建立下游節點」生效。
10. 右鍵空白 → 「在此新增節點」在游標處建立並進入編輯。
11. 框選兩個節點 → 右鍵 → 選單為複製／建立副本／刪除。

剪貼簿：
12. 選兩個相連節點 → ⌘/Ctrl+C → ⌘/Ctrl+V → 出現偏移 24px 的副本含連線，且副本被選取。
13. 右鍵空白 → 「貼上」→ 副本左上角在游標處。
14. ⌘/Ctrl+X → 原節點消失；⌘/Ctrl+V → 貼回。
15. ⌘/Ctrl+D → 原地副本。
16. 在 JSON 編輯器 textarea 內 ⌘/Ctrl+C／V → 正常文字複製貼上，不觸發節點貼上。

Undo 與存檔：
17. 連續做 5 個不同操作 → ⌘/Ctrl+Z 五次逐一復原 → ⌘/Ctrl+Shift+Z 逐一重做。
18. 一鍵排版（⌘/Ctrl+L）→ 復原 → 位置還原。切直式 → 復原 → 方向與 handle 都回橫式。
19. 重新整理 → 內容與橫直方向都保留。
20. devtools console：`localStorage.setItem("causalflow-doc-v1", "{bad")` → 重新整理 → toast「存檔損毀…」、顯示範例、`localStorage.getItem("causalflow-doc-v1-corrupt")` 為 `"{bad"`。

命令面板與說明：
21. ⌘/Ctrl+K → 輸入「排版」→ Enter 執行一鍵排版。
22. ⌘/Ctrl+K → 輸入某節點文字 → Enter → 畫面移到該節點並選取。
23. `?` → 快捷鍵一覽開啟；Esc 關閉。命令面板開啟時按 Tab 不會建立節點。

回歸：
24. 匯入 JSON、匯出 JSON、匯出 PNG、PDF 直式／橫式皆正常。
25. 外觀：畫布背景仍為米色漸層、字型仍為 IBM Plex Sans；右鍵選單、命令面板、對話框為米白紙色系。

- [ ] **Step 3: 修正失敗項**

任何失敗：用 superpowers:systematic-debugging 找根因並修正，重跑 `pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build`，再重測該項與相關項。每個修正獨立 commit。

- [ ] **Step 4: 關閉 dev server**

停止背景的 `pnpm dev`。

- [ ] **Step 5: README**

把 `README.md` 整檔替換為：

```markdown
# CausalFlow

繪製邏輯因果圖：節點、單／雙向連線、正／負／未指定極性，匯入匯出 JSON／PNG／PDF。內容自動存在瀏覽器 localStorage。

## 開發

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # vitest（純邏輯單元測試）
pnpm build
```

## 操作

| 動作 | 方式 |
|---|---|
| 新增節點 | 雙擊空白處；或從節點連接點拖線到空白處（自動連線） |
| 編輯文字 | 雙擊節點、F2 或 Space；Enter 確認、Shift+Enter 換行、Esc 取消 |
| 建立下游／同層節點 | Tab／Enter |
| 切換選取 | 方向鍵 |
| 連線極性 | 選取連線後按 `+` `-` `0`，`B` 切單／雙向 |
| 復原／重做 | ⌘/Ctrl+Z、⌘/Ctrl+Shift+Z |
| 複製／剪下／貼上／副本 | ⌘/Ctrl+C／X／V／D（可跨分頁貼上） |
| 命令面板（含節點搜尋） | ⌘/Ctrl+K |
| 一鍵排版 | ⌘/Ctrl+L |
| 右鍵選單 | 節點、連線、空白處各有對應動作 |
| 全部快捷鍵 | `?` |

JSON 格式見 `IMPORT_JSON.md`。
```

- [ ] **Step 6: 最終驗證並 commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test && pnpm build
git add README.md
git commit -m "docs: document editor shortcuts and dev commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
