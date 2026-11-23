import type { ReactNode } from "react"
import { Handle, Position } from "@xyflow/react"
import {
  CheckIcon,
  PlayIcon,
  RotateCcwIcon,
  XIcon,
  Settings2Icon,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { CodeBlock } from "@workspace/ui/components/code-block"
import { ItemActions } from "@workspace/ui/components/item"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { mono } from "@/components/data/mono"

export type NodeStatus =
  "running" | "waiting" | "done" | "failed" | "skipped" | "cancelled"

const STATUS_LABEL: Record<NodeStatus, string> = {
  running: "Running",
  waiting: "Waiting",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
  cancelled: "Cancelled",
}

/** "yes" shows as "Yes". */
export function branchLabel(branch: string): string {
  return `${branch.charAt(0).toUpperCase()}${branch.slice(1)}`
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
  /** Branch a Judge took, as shown: "Yes" or "No". */
  verdict?: string
  /** Pass of a node that loops, from the second one (DES-034). */
  pass?: number
  /** Out branches (Judge): one labelled handle each, instead of one output. */
  branches?: readonly string[]
  onRun?: () => void
  onRetry?: () => void
  /** Approve or Reject while the step waits for a person (BL-080). */
  onDecide?: (decision: "approve" | "reject") => void
  /** Opens the node Sheet (BL-095). */
  onSettings?: () => void
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
  verdict,
  pass,
  branches,
  onRun,
  onRetry,
  onDecide,
  onSettings,
  children,
}: NodeFrameProps) {
  return (
    <Card
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
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {name}
        </div>
        {status ? (
          <Badge
            variant={status === "failed" ? "destructive" : "outline"}
            data-testid={`node-status-${id}`}
          >
            {status === "running" ? <Spinner data-icon="inline-start" /> : null}
            {STATUS_LABEL[status]}
          </Badge>
        ) : null}
        {verdict ? (
          <Badge variant="secondary" data-testid={`node-verdict-${id}`}>
            {verdict}
          </Badge>
        ) : null}
        {pass && pass > 1 ? (
          <Badge variant="outline" data-testid={`node-pass-${id}`}>
            Pass {pass}
          </Badge>
        ) : null}
        {timer ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {timer}
          </span>
        ) : null}
        {onSettings || onRun ? (
          <ItemActions>
            {onSettings ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="nodrag"
                aria-label="Node settings"
                data-testid={`node-settings-${id}`}
                onClick={onSettings}
              >
                <Settings2Icon />
              </Button>
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
          </ItemActions>
        ) : null}
      </div>
      {children ? <div className="px-3">{children}</div> : null}
      {status === "waiting" && onDecide ? (
        <ItemActions className="px-3" data-testid={`node-decide-${id}`}>
          <Button
            type="button"
            size="sm"
            className="nodrag"
            data-testid={`node-approve-${id}`}
            onClick={() => onDecide("approve")}
          >
            <CheckIcon data-icon="inline-start" />
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="nodrag"
            data-testid={`node-reject-${id}`}
            onClick={() => onDecide("reject")}
          >
            <XIcon data-icon="inline-start" />
            Reject
          </Button>
        </ItemActions>
      ) : null}
      {result || (status === "failed" && onRetry) ? (
        <div className="flex flex-col gap-2 px-3">
          {result ? (
            <CodeBlock
              className={cn(
                "nowheel max-h-32 overflow-auto p-2 whitespace-pre-wrap",
                mono
              )}
              data-testid={`node-result-${id}`}
            >
              {result}
            </CodeBlock>
          ) : null}
          {status === "failed" && onRetry ? (
            <ItemActions>
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
            </ItemActions>
          ) : null}
        </div>
      ) : null}
      {branches ? (
        branches.map((branch, i) => (
          <div
            key={branch}
            className="absolute right-0 flex translate-x-full items-center"
            style={{ top: `${((i + 1) * 100) / (branches.length + 1)}%` }}
          >
            <Handle
              id={branch}
              type="source"
              position={Position.Right}
              title={branchLabel(branch)}
              data-testid={`port-${id}-${branch}`}
              style={{ top: "50%" }}
            />
            <span className="pointer-events-none absolute left-3 text-xs text-muted-foreground">
              {branchLabel(branch)}
            </span>
          </div>
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          title="Output"
          data-testid={`port-${id}-out`}
        />
      )}
    </Card>
  )
}
