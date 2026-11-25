import { ScrollText } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useFlow } from "./flow-context"
import type { NodeKindName, RunState } from "./flow-kinds"
import { showsLogButton } from "./node-logs"

type Props = {
  kind: NodeKindName
  nodeId: string | null
  state?: RunState
}

/** Icon button that opens the node's logs in the followed run. */
export function NodeLogsButton({ kind, nodeId, state }: Props) {
  const { openLogs } = useFlow()
  if (!nodeId || !openLogs || !showsLogButton(kind, state)) return null
  return (
    <Button
      variant="ghost"
      size="icon"
      className="nodrag nopan pointer-events-auto ml-auto shrink-0"
      aria-label="View logs"
      title="View logs"
      data-testid={`node-logs-${nodeId}`}
      onClick={() => openLogs(nodeId)}
    >
      <ScrollText />
    </Button>
  )
}
