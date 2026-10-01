/** 常駐面板佔位 → fitView padding。尺寸與 file-sidebar / toolbar 的 class 對齊，改 class 要一起改。 */

/** 與 Tailwind sm 一致 */
export const NARROW_MAX_WIDTH = 640;
/** 左側欄展開：left-3 + w-64 */
export const SIDEBAR_RIGHT_EDGE = 12 + 256;
/** 左側欄收合：top-3 + 膠囊高度 */
const SIDEBAR_CAPSULE_BOTTOM = 12 + 38;
/** 工具面板展開寬：w-[min(calc(100vw-1.5rem),17.5rem)] */
const TOOLS_WIDTH = 280;
/** 工具面板收合：p-1.5 + h-10 w-10 按鈕 + 邊框 */
const TOOLS_COLLAPSED_WIDTH = 54;
/** 扣掉面板後可用寬度低於此值時放棄避讓（窄螢幕兩面板都展開，避也避不開） */
const MIN_FIT_WIDTH = 200;

export type PanelState = { sidebarCollapsed: boolean; toolsCollapsed: boolean };
export type Insets = { top: number; right: number; bottom: number; left: number };
type Px = `${number}px`;
export type FitPadding = { top: Px; right: Px; bottom: Px; left: Px };

export function isNarrowViewport(width: number): boolean {
  return width < NARROW_MAX_WIDTH;
}

/** 面板在視窗四邊各佔多少 px（含面板與視窗邊的間距） */
export function panelInsets(width: number, panels: PanelState): Insets {
  const headerPad = isNarrowViewport(width) ? 12 : 16; // header p-3 sm:p-4
  const left = panels.sidebarCollapsed
    ? 0
    : Math.min(SIDEBAR_RIGHT_EDGE, width - 12);
  const right =
    headerPad +
    (panels.toolsCollapsed
      ? TOOLS_COLLAPSED_WIDTH
      : Math.min(TOOLS_WIDTH, width - 24));
  const top = panels.sidebarCollapsed ? SIDEBAR_CAPSULE_BOTTOM : 0;
  if (width - left - right < MIN_FIT_WIDTH) {
    return { top, right: 0, bottom: 0, left: 0 };
  }
  return { top, right, bottom: 0, left };
}

/** 同 xyflow 的數字 padding：可見區每邊留 (v - v / (1 + ratio)) / 2 */
function ratioPad(visible: number, ratio: number): number {
  return Math.floor((visible - visible / (1 + ratio)) * 0.5);
}

/** 面板佔位 + 可見區內的比例留白，給 fitView 的分邊 padding */
export function fitPadding(
  width: number,
  height: number,
  insets: Insets,
  ratio: number,
): FitPadding {
  const padX = ratioPad(Math.max(0, width - insets.left - insets.right), ratio);
  const padY = ratioPad(Math.max(0, height - insets.top - insets.bottom), ratio);
  const px = (n: number): Px => `${n}px`;
  return {
    top: px(insets.top + padY),
    right: px(insets.right + padX),
    bottom: px(insets.bottom + padY),
    left: px(insets.left + padX),
  };
}
