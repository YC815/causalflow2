# CausalFlow 匯入 JSON：給 AI 的快速規格

這份文件是「給 AI 產生可匯入 JSON」的最短可執行規格。  
目標：讓 AI 看到後能**一次產出正確格式**，你可直接匯入 CausalFlow。

---

## 1) 先看這三件事（最重要）

1. 根物件必須是 JSON object，且 `causalflowVersion` 必須是數字 `1`。  
2. `nodes`、`edges` 都必填且必須是陣列。  
3. 每條 edge 的 `source` / `target` 必須引用到存在的 node `id`。

---

## 2) AI 產出格式（固定骨架）

```json
{
  "causalflowVersion": 1,
  "title": "可選",
  "nodes": [],
  "edges": []
}
```

---

## 3) 欄位規格（精簡但完整）

### 3.1 根物件

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `causalflowVersion` | `number` | 是 | 固定 `1` |
| `title` | `string` | 否 | 若有提供必須是字串 |
| `nodes` | `array` | 是 | 節點清單 |
| `edges` | `array` | 是 | 邊清單（可空） |

### 3.2 `nodes[]`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | `string` | 是 | 非空白字串，建議唯一 |
| `label` | `string` | 是 | 非空白字串 |
| `x` | `number` | 是 | 有限數字（不可 NaN/Infinity） |
| `y` | `number` | 是 | 有限數字（不可 NaN/Infinity） |

### 3.3 `edges[]`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | `string` | 是 | 非空白字串，建議唯一 |
| `source` | `string` | 是 | 必須等於某個節點 `id` |
| `target` | `string` | 是 | 必須等於某個節點 `id` |
| `direction` | `string` | 是 | `"one-way"` 或 `"bidirectional"` |
| `polarity` | `string` | 是 | `"positive"` / `"negative"` / `"neutral"` |

語意：`source -> target`。

---

## 4) AI 輸出時常見錯誤（請避免）

- 把 `causalflowVersion` 寫成字串 `"1"`（錯）  
- `nodes` 或 `edges` 漏掉（錯）  
- `source`/`target` 指到不存在的 id（錯）  
- `direction`/`polarity` 拼錯字（錯）

---

## 5) 可直接給 AI 的指令模板

把下面整段貼給 AI，再附上你的主題需求：

```text
請輸出「可直接匯入 CausalFlow」的純 JSON（不要 Markdown code block，只有 JSON 本體）。

必須符合：
- causalflowVersion 固定為數字 1
- 根物件包含 title(可省略)、nodes、edges
- nodes: 每個節點都有 id, label, x, y
- edges: 每條邊都有 id, source, target, direction, polarity
- direction 只能是 one-way 或 bidirectional
- polarity 只能是 positive / negative / neutral
- 所有 edge 的 source/target 都必須引用已存在的 node id
- 座標請給出可讀版面的數值（例如 x,y 間距 140~280）
```

---

## 6) 最小可用範例

```json
{
  "causalflowVersion": 1,
  "title": "最小範例",
  "nodes": [
    { "id": "a", "label": "原因", "x": 120, "y": 120 },
    { "id": "b", "label": "結果", "x": 420, "y": 120 }
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
```

---

## 7) NotebookLM 使用提醒（重要）

不要把這份規格全文直接丟到 NotebookLM 的「來源文件」。  
正確做法是：

1. 把這份規格當作你與 AI 對話時的指令參考。  
2. 要產生圖時，在對話中明確要求 AI 按本規格輸出 JSON。  
3. 拿 AI 回覆的 JSON 檔再匯入 CausalFlow。

---

## 8) 實作對照

程式端校驗實作在 `lib/causal-json.ts` 的 `parseCausalJson`。  
若文件與程式行為不一致，以程式為準。
