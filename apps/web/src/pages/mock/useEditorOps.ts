import { useCallback, useEffect, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { FlowEdge, FlowNode } from "./flow-data"

type Setter<T> = Dispatch<SetStateAction<T>>

const plain = (nodes: FlowNode[], edges: FlowEdge[]) =>
  JSON.stringify({
    n: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      data: { ...n.data, state: undefined, result: undefined },
    })),
    e: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      style: e.style,
    })),
  })

/** Undo, redo, duplicate and delete for the canvas (mock: in memory). */
export function useEditorOps(
  nodes: FlowNode[],
  edges: FlowEdge[],
  setNodes: Setter<FlowNode[]>,
  setEdges: Setter<FlowEdge[]>,
  enabled: boolean
) {
  const [hist, setHist] = useState<{ list: string[]; at: number }>({
    list: [],
    at: 0,
  })

  // Settled edits become one history step; dragging and typing coalesce.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = plain(nodes, edges)
      setHist((h) => {
        if (h.list.length === 0) return { list: [s], at: 0 }
        if (s === h.list[h.at]) return h
        const list = [...h.list.slice(0, h.at + 1), s].slice(-50)
        return { list, at: list.length - 1 }
      })
    }, 350)
    return () => clearTimeout(t)
  }, [nodes, edges])

  const go = useCallback(
    (to: number) => {
      const s = hist.list[to]
      if (s === undefined) return
      setHist({ ...hist, at: to })
      const parsed = JSON.parse(s) as { n: FlowNode[]; e: FlowEdge[] }
      setNodes(parsed.n)
      setEdges(parsed.e)
    },
    [hist, setNodes, setEdges]
  )
  const undo = useCallback(() => go(hist.at - 1), [go, hist.at])
  const redo = useCallback(() => go(hist.at + 1), [go, hist.at])

  const duplicate = useCallback(
    (id: string) =>
      setNodes((prev) => {
        const src = prev.find((n) => n.id === id)
        if (!src || src.type === "trigger") return prev
        const copy: FlowNode = {
          ...src,
          id: `${src.type}-${Date.now().toString(36)}`,
          position: { x: src.position.x + 40, y: src.position.y + 40 },
          data: { ...src.data, state: undefined, result: undefined },
          selected: true,
        }
        return [...prev.map((n) => ({ ...n, selected: false })), copy]
      }),
    [setNodes]
  )

  const remove = useCallback(
    (id: string) => {
      if (nodes.find((n) => n.id === id)?.type === "trigger") return
      setNodes((prev) => prev.filter((n) => n.id !== id))
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id))
    },
    [nodes, setNodes, setEdges]
  )

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
      } else if (k === "d") {
        ev.preventDefault()
        nodes.filter((n) => n.selected).forEach((n) => duplicate(n.id))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, nodes, undo, redo, duplicate])

  return {
    undo,
    redo,
    duplicate,
    remove,
    canUndo: hist.at > 0,
    canRedo: hist.at < hist.list.length - 1,
  }
}
