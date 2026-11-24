import { useEffect } from "react"
import type { CanvasEdge, CanvasNode } from "./flow-graph"

/** Duplicate / delete selected nodes and wires from the keyboard. */
export function useCanvasKeys(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  duplicate: (id: string) => void,
  remove: (id: string) => void,
  removeEdges: (edges: CanvasEdge[]) => void,
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
        const wires = edges.filter((e) => e.selected)
        if (selected.length === 0 && wires.length === 0) return
        ev.preventDefault()
        if (wires.length > 0) removeEdges(wires)
        selected.forEach((id) => remove(id))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [nodes, edges, duplicate, remove, removeEdges, enabled])
}
