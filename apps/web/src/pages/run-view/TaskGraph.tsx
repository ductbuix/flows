import { useMemo } from "react"
import type { RunDetail } from "@workspace/shared"
import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { buildTaskGraph } from "./task-graph-layout"

type TaskNodeData = {
  label: string
  status: string
  attempts: number
  spawned: boolean
}

function TaskNode({ id, data, selected }: NodeProps<Node<TaskNodeData>>) {
  return (
    <Card
      size="sm"
      data-testid={`task-node-${id}`}
      className={cn("min-w-40 shadow-sm", selected && "ring-2 ring-ring")}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <CardContent>
        <div className="font-mono font-medium">{data.label}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="outline">{data.status}</Badge>
          <span className="text-muted-foreground">{data.attempts} att.</span>
          {data.spawned && <Badge variant="outline">spawned</Badge>}
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </Card>
  )
}

const nodeTypes = { task: TaskNode }

type Props = {
  run: RunDetail
  selectedTaskId?: string
  onSelectTask: (taskId: string) => void
}

export function TaskGraph({ run, selectedTaskId, onSelectTask }: Props) {
  const { nodes, edges } = useMemo(() => buildTaskGraph(run), [run])

  const flowNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
      })),
    [nodes, selectedTaskId]
  )

  return (
    <div className="h-full min-h-80 w-full" data-testid="run-graph">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        onNodeClick={(_evt, node) => onSelectTask(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
