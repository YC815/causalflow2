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
                value={a.id}
                keywords={[a.label]}
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
                  value={n.id}
                  keywords={[n.data.label]}
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
