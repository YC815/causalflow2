"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function NewBlankDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="causal-ui sm:max-w-md">
        <DialogHeader>
          <DialogTitle>清空目前的圖？</DialogTitle>
          <DialogDescription>
            所有節點與連線會被移除。清空後仍可用 ⌘/Ctrl+Z 復原，但重新整理頁面後就無法復原。建議先匯出 JSON 備份。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            清空
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
