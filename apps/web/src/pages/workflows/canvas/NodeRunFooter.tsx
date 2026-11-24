import { RotateCcw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { NodeKindName, RunState } from "./flow-kinds"
import { useFlow } from "./flow-context"
import { NodeInboxPrompt } from "./NodeInboxPrompt"
import { NodeLogsButton } from "./NodeLogsButton"

/** Kinds whose card has a connectors/skills row that hosts the Logs button. */
const HAS_BADGE_ROW: ReadonlySet<NodeKindName> = new Set(["llm", "agent"])

const FIELD = "rounded-2xl bg-muted/60 p-3"

type Props = {
  kind: NodeKindName
  nodeId: string | null
  state?: RunState
  result?: string
  onRetry?: (id: string) => void
}

/** Result text and Retry for a failed node during a run view. */
export function NodeRunFooter({ kind, nodeId, state, result, onRetry }: Props) {
  const { inbox } = useFlow()
  const ask = nodeId ? inbox?.[nodeId] : undefined
  return (
    <>
      {ask ? <NodeInboxPrompt item={ask} /> : null}
      {result ? (
        <div
          className={cn(
            FIELD,
            "nowheel max-h-28 overflow-auto text-xs text-muted-foreground"
          )}
          data-testid={nodeId ? `node-result-${nodeId}` : undefined}
        >
          {result}
        </div>
      ) : null}
      {state === "failed" && nodeId && onRetry ? (
        <Button
          variant="outline"
          className="nodrag nopan pointer-events-auto w-fit"
          data-testid={`node-retry-${nodeId}`}
          onClick={() => onRetry(nodeId)}
        >
          <RotateCcw />
          Retry
        </Button>
      ) : null}
      {HAS_BADGE_ROW.has(kind) ? null : (
        <div className="flex">
          <NodeLogsButton kind={kind} nodeId={nodeId} state={state} />
        </div>
      )}
    </>
  )
}
