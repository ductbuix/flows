import { useCallback, useRef, useEffect } from "react"
import {
  addEdge,
  addNode,
  removeEdge,
  removeNode,
  setNodeKey,
  type LayoutFile,
  type NodeKindName,
  type Workflow,
  type WorkflowEdge,
} from "@workspace/contracts"
import type { CanvasNodeData } from "./flow-kinds"
import { cloneNodeRecord, defaultNode, newNodeId } from "./default-node"

function applyPatch(yaml: string, id: string, patch: Record<string, unknown>) {
  let next = yaml
  for (const [key, value] of Object.entries(patch)) {
    next = setNodeKey(next, id, key, value)
  }
  return next
}

/** YAML + layout mutations for add / update / duplicate / delete. */
export function useCanvasOps(
  yaml: string,
  layout: LayoutFile,
  workflow: Workflow,
  onYamlChange: (yaml: string) => void,
  onLayoutChange: (layout: LayoutFile) => void,
  onRemoved?: (id: string) => void
) {
  const yamlRef = useRef(yaml)
  const layoutRef = useRef(layout)
  const workflowRef = useRef(workflow)
  useEffect(() => {
    yamlRef.current = yaml
    layoutRef.current = layout
    workflowRef.current = workflow
  })

  const update = useCallback(
    (id: string, patch: Partial<CanvasNodeData> | Record<string, unknown>) => {
      const keys = { ...patch } as Record<string, unknown>
      delete keys.kind
      delete keys.summary
      delete keys.state
      delete keys.result
      onYamlChange(applyPatch(yamlRef.current, id, keys))
    },
    [onYamlChange]
  )

  const remove = useCallback(
    (id: string) => {
      const n = workflowRef.current.nodes.find((x) => x.id === id)
      if (!n || n.kind === "trigger") return
      onYamlChange(removeNode(yamlRef.current, id))
      const nodesMap = { ...layoutRef.current.nodes }
      delete nodesMap[id]
      onLayoutChange({ ...layoutRef.current, nodes: nodesMap })
      onRemoved?.(id)
    },
    [onYamlChange, onLayoutChange, onRemoved]
  )

  const duplicate = useCallback(
    (id: string) => {
      const src = workflowRef.current.nodes.find((x) => x.id === id)
      if (!src || src.kind === "trigger") return
      const copyId = newNodeId(src.kind)
      const pos = layoutRef.current.nodes[id] ?? { x: 0, y: 0 }
      onYamlChange(addNode(yamlRef.current, cloneNodeRecord(src, copyId)))
      onLayoutChange({
        ...layoutRef.current,
        nodes: {
          ...layoutRef.current.nodes,
          [copyId]: { x: pos.x + 40, y: pos.y + 40 },
        },
      })
    },
    [onYamlChange, onLayoutChange]
  )

  const add = useCallback(
    (kind: NodeKindName) => {
      if (
        kind === "trigger" &&
        workflowRef.current.nodes.some((n) => n.kind === "trigger")
      ) {
        return
      }
      const id = newNodeId(kind)
      const last = Object.values(layoutRef.current.nodes).at(-1)
      onYamlChange(addNode(yamlRef.current, defaultNode(kind, id)))
      onLayoutChange({
        ...layoutRef.current,
        nodes: {
          ...layoutRef.current.nodes,
          [id]: { x: (last?.x ?? 0) + 80, y: (last?.y ?? 0) + 120 },
        },
      })
    },
    [onYamlChange, onLayoutChange]
  )

  const connect = useCallback(
    (edge: WorkflowEdge) => onYamlChange(addEdge(yamlRef.current, edge)),
    [onYamlChange]
  )

  const disconnect = useCallback(
    (edges: readonly WorkflowEdge[]) => {
      let next = yamlRef.current
      for (const e of edges) next = removeEdge(next, e)
      if (next !== yamlRef.current) onYamlChange(next)
    },
    [onYamlChange]
  )

  return { update, remove, duplicate, add, connect, disconnect }
}
