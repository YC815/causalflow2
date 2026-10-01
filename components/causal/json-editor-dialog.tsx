"use client";

import { useEffect, useState } from "react";
import {
  CAUSAL_JSON_AI_GUIDE,
  CausalJsonError,
  parseCausalJson,
  stringifyCausalJson,
} from "@/lib/causal-json";
import { useCausalStore } from "@/lib/store/causal-store";
import { shellBtn, shellBtnPrimary } from "./ui-classes";
import type { CausalCommands } from "./use-causal-commands";

function toLineCol(text: string, index: number): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < safe; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/** 純語法檢查；回傳帶行列號的訊息，語法正確則回 null */
function jsonSyntaxError(raw: string): string | null {
  try {
    JSON.parse(raw);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON 語法錯誤";
    const match = /position\s+(\d+)/i.exec(message);
    if (!match) return `JSON 語法錯誤：${message}`;
    const pos = Number(match[1]);
    const { line, column } = toLineCol(raw, pos);
    return `JSON 語法錯誤：第 ${line} 行，第 ${column} 列（字元位置 ${pos}）`;
  }
}

export function JsonEditorDialog({
  commands,
  onClose,
}: {
  commands: CausalCommands;
  onClose: () => void;
}) {
  const showToast = useCausalStore((s) => s.showToast);
  const [text, setText] = useState(() => commands.currentJson());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fail = (message: string) => {
    setError(message);
    showToast(message);
  };

  const apply = () => {
    const syntax = jsonSyntaxError(text);
    if (syntax) return fail(syntax);
    const err = commands.importText(text);
    if (err) return fail(err);
    showToast("已套用 JSON 變更");
    onClose();
  };

  const format = () => {
    const syntax = jsonSyntaxError(text);
    if (syntax) return fail(syntax);
    try {
      setText(stringifyCausalJson(parseCausalJson(text)));
      setError(null);
      showToast("已自動格式化 JSON");
    } catch (err) {
      fail(err instanceof CausalJsonError ? err.message : "JSON 格式化失敗");
    }
  };

  const copyErrorWithGuide = async () => {
    if (!error) return;
    const payload = [
      "請協助修復以下 CausalFlow JSON 錯誤：",
      `錯誤訊息：${error}`,
      "",
      CAUSAL_JSON_AI_GUIDE,
      "",
      "目前 JSON 內容：",
      text,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      showToast("已複製錯誤訊息與 JSON 規則");
    } catch {
      showToast("複製失敗，請手動複製錯誤訊息與 JSON");
    }
  };

  return (
    <div
      className="causal-ui absolute inset-0 z-[110] flex items-center justify-center bg-black/45 p-3 sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="JSON 編輯器"
        className="flex h-[90dvh] w-[90vw] max-w-none flex-col rounded-2xl border border-[var(--causal-node-border)] bg-[var(--causal-paper)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--causal-node-border)] px-3 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--causal-ink)]">JSON 編輯器</h2>
          <button type="button" onClick={onClose} className={shellBtn}>
            關閉
          </button>
        </header>
        <div className="min-h-0 flex-1 p-3">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            className="causal-mono h-full w-full resize-none rounded-lg border border-[var(--causal-node-border)] bg-white px-3 py-2 text-xs leading-6 text-[var(--causal-ink)]"
            spellCheck={false}
          />
          {error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              <p>{error}</p>
              <p className="mt-1 text-[11px] text-red-600">
                若不確定如何修復，可將錯誤訊息貼給 AI。
              </p>
              <button
                type="button"
                onClick={() => void copyErrorWithGuide()}
                className="mt-2 rounded-md border border-red-300 bg-white px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-100"
              >
                複製錯誤訊息＋JSON 規則給 AI
              </button>
            </div>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--causal-node-border)] px-3 py-2.5">
          <button type="button" onClick={format} className={shellBtn}>
            自動格式化 JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setText(commands.currentJson());
              setError(null);
            }}
            className={shellBtn}
          >
            重新載入目前 JSON
          </button>
          <button type="button" onClick={apply} className={shellBtnPrimary}>
            套用變更
          </button>
        </footer>
      </section>
    </div>
  );
}
