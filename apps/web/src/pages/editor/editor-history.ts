export type EditorSnapshot = {
  yaml: string
  selectedTaskId?: string
}

export const EDITOR_HISTORY_CAP = 50

export type EditorHistory = {
  past: EditorSnapshot[]
  future: EditorSnapshot[]
}

export const emptyEditorHistory: EditorHistory = { past: [], future: [] }

export function pushEditorSnapshot(
  history: EditorHistory,
  snap: EditorSnapshot
): EditorHistory {
  const past = [...history.past, snap]
  const trimmed =
    past.length > EDITOR_HISTORY_CAP
      ? past.slice(past.length - EDITOR_HISTORY_CAP)
      : past
  return { past: trimmed, future: [] }
}

export function undoEditor(
  history: EditorHistory,
  current: EditorSnapshot
): { history: EditorHistory; snap: EditorSnapshot } | null {
  if (history.past.length === 0) return null
  const past = history.past.slice(0, -1)
  const snap = history.past[history.past.length - 1]!
  return {
    history: { past, future: [current, ...history.future] },
    snap,
  }
}

export function redoEditor(
  history: EditorHistory,
  current: EditorSnapshot
): { history: EditorHistory; snap: EditorSnapshot } | null {
  if (history.future.length === 0) return null
  const [snap, ...future] = history.future
  return {
    history: {
      past: [...history.past, current],
      future,
    },
    snap: snap!,
  }
}
