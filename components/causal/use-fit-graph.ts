"use client";

import { type FitViewOptions, useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import {
  fitPadding,
  type FitPadding,
  type PanelState,
  panelInsets,
} from "@/lib/panel-insets";

export type FitGraphOptions = Omit<FitViewOptions, "padding"> & {
  /** 可見區內的比例留白，語意同 fitView 的數字 padding */
  ratio?: number;
};
export type FitGraph = (opts?: FitGraphOptions) => Promise<boolean>;

/** 以目前視窗大小與面板狀態算 fitView padding；呼叫當下才量視窗 */
export function currentFitPadding(panels: PanelState, ratio = 0.2): FitPadding {
  const { innerWidth: w, innerHeight: h } = window;
  return fitPadding(w, h, panelInsets(w, panels), ratio);
}

/** 避開常駐面板的 fitView；所有「讓圖入鏡」都走這裡 */
export function useFitGraph({ sidebarCollapsed, toolsCollapsed }: PanelState): FitGraph {
  const { fitView } = useReactFlow();
  return useCallback(
    ({ ratio, ...opts } = {}) =>
      fitView({
        ...opts,
        padding: currentFitPadding({ sidebarCollapsed, toolsCollapsed }, ratio),
      }),
    [fitView, sidebarCollapsed, toolsCollapsed],
  );
}
