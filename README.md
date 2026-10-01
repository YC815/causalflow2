# CausalFlow

繪製邏輯因果圖：節點、單向連線、正／負／未指定極性，匯入匯出 JSON／PNG／PDF。內容自動存在瀏覽器 localStorage。

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
| 連線極性 | 選取連線後按 `+` `-` `0` |
| 復原／重做 | ⌘/Ctrl+Z、⌘/Ctrl+Shift+Z、⌘/Ctrl+Y |
| 全選 | ⌘/Ctrl+A |
| 複製／剪下／貼上／副本 | ⌘/Ctrl+C／X／V／D（可跨分頁貼上） |
| 命令面板（含節點搜尋） | ⌘/Ctrl+K |
| 一鍵排版 | ⌘/Ctrl+L |
| 右鍵選單 | 節點、連線、空白處各有對應動作 |
| 全部快捷鍵 | `?` |

JSON 格式見 `IMPORT_JSON.md`。
