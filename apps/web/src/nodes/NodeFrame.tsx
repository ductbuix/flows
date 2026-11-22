import type { ReactNode } from "react"
import { Handle, Position } from "@xyflow/react"
import { PlayIcon, RotateCcwIcon, type LucideIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { CodeBlock } from "@workspace/ui/components/code-block"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

export type NodeStatus = "running" | "waiting" | "done" | "failed" | "skipped"

const STATUS_LABEL: Record<NodeStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
}

export type NodeFrameProps = {
  id: string
  name: string
  icon: LucideIcon
  /** Steps are `w-72`; inputs and flow are `w-60`. */
  wide: boolean
  selected?: boolean
  /** Run state slots; empty while the editor is not following a run. */
  status?: NodeStatus
  timer?: string
  result?: string
  onRun?: () => void
  onRetry?: () => void
  children?: ReactNode
}

/** Shared card: header, ports, status, timer, result, Run step and Retry. */
export function NodeFrame({
  id,
  name,
  icon: Icon,
  wide,
  selected,
  status,
  timer,
  result,
  onRun,
  onRetry,
  children,
}: NodeFrameProps) {
  return (
    <Card
      size="sm"
      data-testid={`node-${id}`}
      className={cn(
        "overflow-visible shadow-sm",
        wide ? "w-72" : "w-60",
        selected && "ring-2 ring-ring"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        title="Input"
        data-testid={`port-${id}-in`}
      />
      <div className="flex items-center gap-2 px-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{name}</div>
        {status ? (
          <Badge
            variant={status === "failed" ? "destructive" : "outline"}
            data-testid={`node-status-${id}`}
          >
            {status === "running" ? <Spinner data-icon="inline-start" /> : null}
            {STATUS_LABEL[status]}
          </Badge>
        ) : null}
        {timer ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {timer}
          </span>
        ) : null}
        {onRun ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="nodrag"
            aria-label="Run step"
            data-testid={`node-run-${id}`}
            onClick={onRun}
          >
            <PlayIcon />
          </Button>
        ) : null}
      </div>
      {children ? <div className="px-3">{children}</div> : null}
      {result || (status === "failed" && onRetry) ? (
        <div className="flex flex-col gap-2 px-3">
          {result ? (
            <CodeBlock
              size="sm"
              className="nowheel max-h-32 overflow-auto p-2 font-mono whitespace-pre-wrap"
              data-testid={`node-result-${id}`}
            >
              {result}
            </CodeBlock>
          ) : null}
          {status === "failed" && onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="nodrag self-start"
              onClick={onRetry}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        title="Output"
        data-testid={`port-${id}-out`}
      />
    </Card>
  )
}
