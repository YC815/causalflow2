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
        { keys: [["F"]], label: "翻轉輸入／輸出" },
        { keys: [["雙擊"]], label: "編輯節點／在空白處新增" },
        { keys: [["拖曳節點圓點"]], label: "放到另一節點＝連線／放到空白處＝新增相連節點" },
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
        { keys: [["拖曳圓圈"]], label: "改變連線形狀（雙擊重設）" },
        { keys: [["拖曳線頭"]], label: "改接另一側或其他節點" },
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
