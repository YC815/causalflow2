"use client";

import { createContext, useContext, type ReactNode } from "react";

/** 橫式：左右連接；直式：上下連接 */
export type CausalFlowOrientation = "horizontal" | "vertical";

const CausalOrientationContext =
  createContext<CausalFlowOrientation>("horizontal");

export function CausalOrientationProvider({
  orientation,
  children,
}: {
  orientation: CausalFlowOrientation;
  children: ReactNode;
}) {
  return (
    <CausalOrientationContext.Provider value={orientation}>
      {children}
    </CausalOrientationContext.Provider>
  );
}

export function useCausalFlowOrientation(): CausalFlowOrientation {
  return useContext(CausalOrientationContext);
}
