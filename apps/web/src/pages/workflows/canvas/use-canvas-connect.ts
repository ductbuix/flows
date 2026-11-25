import {
  useCallback,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import type { OnNodeDrag, Viewport } from "@xyflow/react"
import type { LayoutFile, Workflow } from "@workspace/contracts"
import {
  canvasToLayout,
  connectionToEdge,
  type CanvasEdge,
  type CanvasNode,
} from "./flow-graph"
import { resolveCollisions } from "./resolve-collisions"
import type { useCanvasOps } from "./use-canvas-ops"

/** The wire fields connectionToEdge reads, from a drawn or existing edge. */
type Wire = {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

type Options = {
  workflow: Workflow
  layout: LayoutFile
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  viewportRef: RefObject<Viewport | undefined>
  onLayoutChange: (layout: LayoutFile) => void
  ops: Pick<ReturnType<typeof useCanvasOps>, "connect" | "disconnect">
}

/** Wire rules, edge removal and drag-stop collision handling for the canvas. */
export function useCanvasConnect({
  workflow,
  layout,
  nodes,
  edges,
  setNodes,
  viewportRef,
  onLayoutChange,
  ops,
}: Options) {
  const { connect, disconnect } = ops
  const kindOf = useCallback(
    (id: string) => workflow.nodes.find((n) => n.id === id)?.kind,
    [workflow.nodes]
  )
  const removeEdges = useCallback(
    (wires: CanvasEdge[]) =>
      disconnect(
        wires.flatMap((w) => {
          const e = connectionToEdge(w, kindOf)
          return e ? [e] : []
        })
      ),
    [disconnect, kindOf]
  )
  const isValidConnection = useCallback(
    (c: Wire) => {
      const e = connectionToEdge(c, kindOf)
      return (
        e !== null &&
        !edges.some(
          (x) =>
            x.source === c.source &&
            x.target === c.target &&
            x.sourceHandle === c.sourceHandle &&
            x.targetHandle === c.targetHandle
        )
      )
    },
    [edges, kindOf]
  )
  const onConnect = useCallback(
    (c: Wire) => {
      const e = connectionToEdge(c, kindOf)
      if (e) connect(e)
    },
    [connect, kindOf]
  )
  const publishLayout = useCallback(
    (next: CanvasNode[]) => {
      onLayoutChange(
        canvasToLayout(
          next,
          viewportRef.current
            ? {
                x: viewportRef.current.x,
                y: viewportRef.current.y,
                zoom: viewportRef.current.zoom,
              }
            : layout.viewport
        )
      )
    },
    [onLayoutChange, viewportRef, layout.viewport]
  )
  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_e, node, dragged) => {
      const pinned = new Set(dragged.map((n) => n.id))
      pinned.add(node.id)
      const canvas = resolveCollisions(
        nodes.map(
          (n) => (dragged.find((d) => d.id === n.id) ?? n) as CanvasNode
        ),
        { pinned }
      )
      setNodes(canvas)
      publishLayout(canvas)
    },
    [nodes, setNodes, publishLayout]
  )
  return { removeEdges, isValidConnection, onConnect, onNodeDragStop }
}
