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
      <ContextMenuItem onSelect={() => commands.toggleFlipSelected()}>
        翻轉輸入／輸出
        <ContextMenuShortcut>F</ContextMenuShortcut>
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
          <ContextMenuItem onSelect={commands.reverseSelectedEdge}>
            反轉方向
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.toggleSelectedEdgeSide("source")}>
            起點改接另一側
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => commands.toggleSelectedEdgeSide("target")}>
            終點改接另一側
          </ContextMenuItem>
          <ContextMenuItem onSelect={commands.resetSelectedEdgeBend}>
            重設彎曲
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
        <ContextMenuContent
          className="causal-ui w-52"
          // 選單關閉時 Radix 會把焦點還給開啟前的節點，搶走剛建立的編輯框焦點
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <MenuItems target={target} commands={commands} />
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
