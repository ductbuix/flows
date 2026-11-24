import { useCallback, useEffect, useRef, useState } from "react"
import type { LayoutFile } from "@workspace/contracts"

export type EditorSnapshot = { yaml: string; layout: LayoutFile }

function same(a: EditorSnapshot, b: EditorSnapshot): boolean {
  return (
    a.yaml === b.yaml &&
    JSON.stringify(a.layout) === JSON.stringify(b.layout)
  )
}

/**
 * Debounced undo/redo for yaml + layout. Caller remounts when the
 * workflow loads so the first snapshot is the saved file (BL-202).
 */
export function useEditorHistory(
  yaml: string,
  layout: LayoutFile,
  apply: (next: EditorSnapshot) => void,
  enabled: boolean
) {
  const [hist, setHist] = useState<{ list: EditorSnapshot[]; at: number }>(
    () => ({ list: [{ yaml, layout }], at: 0 })
  )
  const applying = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const s: EditorSnapshot = { yaml, layout }
    if (applying.current) {
      applying.current = false
      return
    }
    const t = setTimeout(() => {
      setHist((h) => {
        const cur = h.list[h.at]
        if (cur && same(s, cur)) return h
        const list = [...h.list.slice(0, h.at + 1), s].slice(-50)
        return { list, at: list.length - 1 }
      })
    }, 350)
    return () => clearTimeout(t)
  }, [yaml, layout, enabled])

  const go = useCallback(
    (to: number) => {
      const s = hist.list[to]
      if (s === undefined) return
      applying.current = true
      setHist({ ...hist, at: to })
      apply(s)
    },
    [hist, apply]
  )

  const undo = useCallback(() => go(hist.at - 1), [go, hist.at])
  const redo = useCallback(() => go(hist.at + 1), [go, hist.at])

  useEffect(() => {
    if (!enabled) return
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement
      if (el.closest("input, textarea, [contenteditable=true]")) return
      if (!(ev.metaKey || ev.ctrlKey)) return
      const k = ev.key.toLowerCase()
      if (k === "z") {
        ev.preventDefault()
        if (ev.shiftKey) redo()
        else undo()
      } else if (k === "y") {
        ev.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, undo, redo])

  return {
    undo,
    redo,
    canUndo: hist.at > 0,
    canRedo: hist.at < hist.list.length - 1,
  }
}
