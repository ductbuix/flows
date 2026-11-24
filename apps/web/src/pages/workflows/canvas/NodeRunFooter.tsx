import { RotateCcw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { RunState } from "./flow-kinds"

const FIELD = "rounded-2xl bg-muted/60 p-3"

type Props = {
  nodeId: string | null
  state?: RunState
  result?: string
  onRetry?: (id: string) => void
}

/** Result text and Retry for a failed node during a run view. */
export function NodeRunFooter({ nodeId, state, result, onRetry }: Props) {
  return (
    <>
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
    </>
  )
}
