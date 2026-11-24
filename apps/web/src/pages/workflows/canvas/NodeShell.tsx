import type { ReactNode } from "react"
import { NodeToolbar, Position, useNodeId } from "@xyflow/react"
import { Copy, Settings2, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import { useFlow } from "./flow-context"
import {
  HAS_SETTINGS,
  KIND_ICON,
  KIND_LABEL,
  type NodeKindName,
  type RunState,
} from "./flow-kinds"
import { NodeRunFooter } from "./NodeRunFooter"

const STATE_TONE: Record<RunState, Tone> = {
  running: "working",
  done: "done",
  failed: "failed",
  waiting: "attention",
  skipped: "idle",
}
const STATE_LABEL: Record<RunState, string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
  waiting: "Needs you",
  skipped: "Skipped",
}
const STATE_RING: Partial<Record<RunState, string>> = {
  running: "ring-info/50",
  failed: "ring-destructive/60",
  waiting: "ring-warning/60",
}

type ShellProps = {
  kind: NodeKindName
  /** Node name from YAML; the kind label shows when unset. */
  name?: string
  selected?: boolean
  wide?: boolean
  state?: RunState
  result?: string
  children: ReactNode
}

/** Label above, rounded body below; ports sit outside the body. */
export function NodeShell({
  kind,
  name,
  selected,
  wide,
  state,
  result,
  children,
}: ShellProps) {
  const Icon = KIND_ICON[kind]
  const nodeId = useNodeId()
  const { duplicate, remove, openSettings, readOnly, retry } = useFlow()
  return (
    <div
      data-selected={selected ? "true" : "false"}
      data-testid={`canvas-node-${kind}`}
      className={cn(
        "group/node flex flex-col gap-1.5",
        wide ? "w-96" : "w-72",
        state === "skipped" && "opacity-40"
      )}
    >
      {nodeId && !readOnly && kind !== "trigger" ? (
        <NodeToolbar
          isVisible={selected}
          position={Position.Top}
          offset={8}
          className="!z-50"
        >
          <div className="flex gap-1 rounded-2xl bg-card p-1 ring-1 ring-foreground/10">
            {HAS_SETTINGS.has(kind) ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Node settings"
                data-testid="node-open-settings"
                onClick={() => openSettings(nodeId)}
              >
                <Settings2 />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Duplicate node"
              data-testid="node-duplicate"
              onClick={() => duplicate(nodeId)}
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete node"
              data-testid="node-delete"
              onClick={() => remove(nodeId)}
            >
              <Trash2 />
            </Button>
          </div>
        </NodeToolbar>
      ) : null}
      <div className="flex min-h-6 items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="flex-1 truncate">
          {name ? (
            <>
              <span className="text-foreground">{name}</span>
              <span> · {KIND_LABEL[kind]}</span>
            </>
          ) : (
            KIND_LABEL[kind]
          )}
        </span>
        {state && state !== "skipped" ? (
          <StatusPill tone={STATE_TONE[state]}>{STATE_LABEL[state]}</StatusPill>
        ) : state === "skipped" ? (
          <span>Skipped</span>
        ) : null}
      </div>
      <div
        className={cn(
          "relative flex flex-col gap-2 rounded-3xl bg-card p-2 ring-1 ring-foreground/10",
          state && STATE_RING[state] && `ring-2 ${STATE_RING[state]}`,
          selected && "ring-2 ring-ring"
        )}
      >
        {children}
        <NodeRunFooter
          kind={kind}
          nodeId={nodeId}
          state={state}
          result={result}
          onRetry={retry}
        />
      </div>
    </div>
  )
}

export const FIELD = "rounded-2xl bg-muted/60 p-3"
