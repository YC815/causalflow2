/** Undo／Redo 的 snapshot 堆疊（純函式，不依賴 React）。 */

export const HISTORY_LIMIT = 100;

export type History<T> = { past: T[]; future: T[] };

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function record<T>(h: History<T>, snapshot: T): History<T> {
  const past = [...h.past, snapshot];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, future: [] };
}

export function undo<T>(
  h: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (h.past.length === 0) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future] },
    state: h.past[h.past.length - 1],
  };
}

export function redo<T>(
  h: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (h.future.length === 0) return null;
  const [state, ...future] = h.future;
  return { history: { past: [...h.past, current], future }, state };
}

export function discardLast<T>(h: History<T>): History<T> {
  return { past: h.past.slice(0, -1), future: h.future };
}
