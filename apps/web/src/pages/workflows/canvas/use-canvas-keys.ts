import { useEffect } from "react"
import type { CanvasNode } from "./flow-graph"

/** Duplicate / delete selected nodes from the keyboard while editing. */
export function useCanvasKeys(
  nodes: CanvasNode[],
  duplicate: (id: string) => void,
  remove: (id: string) => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement
      if (
        el.closest("input, textarea, [contenteditable=true], [role='combobox']")
      ) {
        return
      }
      const selected = nodes.filter((n) => n.selected).map((n) => n.id)
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") {
        ev.preventDefault()
        selected.forEach((id) => duplicate(id))
        return
      }
      if (ev.key === "Backspace" || ev.key === "Delete") {
        if (selected.length === 0) return
        ev.preventDefault()
        selected.forEach((id) => remove(id))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nodes, duplicate, remove, enabled])
}
