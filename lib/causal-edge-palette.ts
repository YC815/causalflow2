import type { CausalPolarity } from "@/lib/causal-json";

/**
 * 與 app/globals.css 的 --causal-edge-pos / neg / neutral 一致。
 * React Flow 的箭頭在 SVG `<marker>` 內以 inline style 著色，多數瀏覽器對 `var()` 解析不可靠。
 */
export const CAUSAL_EDGE_STROKE_HEX: Record<CausalPolarity, string> = {
  positive: "#1a5c4a",
  negative: "#9a3d32",
  neutral: "#5c564c",
};
