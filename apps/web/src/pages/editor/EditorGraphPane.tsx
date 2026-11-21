import type { Workflow } from "@workspace/shared"
import { EditorGraph } from "./EditorGraph"

type Props = {
  workflow: Workflow | null
  selectedTaskId?: string
  onSelectTask: (taskId: string | undefined) => void
  onConnect: (source: string, target: string) => void
}

/** Graph or a placeholder when YAML is invalid. */
export function EditorGraphPane({
  workflow,
  selectedTaskId,
  onSelectTask,
  onConnect,
}: Props) {
  if (!workflow) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Fix YAML errors to show the graph (last valid state kept when possible).
      </div>
    )
  }
  return (
    <EditorGraph
      workflow={workflow}
      selectedTaskId={selectedTaskId}
      onSelectTask={onSelectTask}
      onConnect={onConnect}
    />
  )
}
