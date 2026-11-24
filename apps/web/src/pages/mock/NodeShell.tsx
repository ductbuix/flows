import type { ReactNode } from "react"
import {
  Handle,
  NodeToolbar,
  Position,
  useConnection,
  useNodeConnections,
  useNodeId,
} from "@xyflow/react"
import {
  Bell,
  Bot,
  Copy,
  GitFork,
  HandHelping,
  Image,
  Plus,
  Settings2,
  Trash2,
  Type,
  Zap,
  FileText,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useFlow } from "./flow-context"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import { cn } from "@workspace/ui/lib/utils"
import { KIND_LABEL, type NodeKind, type RunState } from "./flow-data"

const KIND_ICON: Record<NodeKind, typeof Zap> = {
  trigger: Zap,
  asset: FileText,
  llm: Bot,
  condition: GitFork,
  approval: HandHelping,
  notify: Bell,
}

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

export const PORT_STYLE = {
  text: "bg-info/20! text-info ring-info/40",
  image: "bg-warning/20! text-warning ring-warning/40",
  any: "bg-muted! text-foreground ring-foreground/20",
}

type Port = keyof typeof PORT_STYLE

type PortProps = {
  io: "in" | "out"
  port?: Port
  /** Handle id when it differs from the port type (condition branches). */
  id?: string
  top?: number | string
  /** Distance outside the node body. */
  gap?: number
}

/** A typed connection point: T carries text, the picture icon an image. */
export function PortHandle({
  io,
  port = "text",
  id,
  top = "50%",
  gap = 16,
}: PortProps) {
  const Icon = port === "text" ? Type : port === "image" ? Image : Plus
  const handleId = id ?? port
  const linked =
    useNodeConnections({
      handleType: io === "in" ? "target" : "source",
      handleId,
    }).length > 0
  const { inProgress } = useConnection()
  return (
    <Handle
      id={handleId}
      type={io === "in" ? "target" : "source"}
      position={io === "in" ? Position.Left : Position.Right}
      style={{ top, [io === "in" ? "left" : "right"]: -gap }}
      className={cn(
        "flex size-6! items-center justify-center rounded-full! border-0! ring-1 transition-opacity hover:opacity-100",
        PORT_STYLE[port],
        !linked &&
          !inProgress &&
          "opacity-0 group-hover/node:opacity-100 group-data-[selected=true]/node:opacity-100"
      )}
    >
      <Icon className="pointer-events-none size-3" />
    </Handle>
  )
}

type ShellProps = {
  kind: NodeKind
  selected?: boolean
  wide?: boolean
  state?: RunState
  children: ReactNode
}

/** Label above, rounded body below; ports sit outside the body. */
export function NodeShell({
  kind,
  selected,
  wide,
  state,
  children,
}: ShellProps) {
  const Icon = KIND_ICON[kind]
  const nodeId = useNodeId()
  const { duplicate, remove, openSettings, readOnly } = useFlow()
  return (
    <div
      data-selected={selected ? "true" : "false"}
      className={cn(
        "group/node flex flex-col gap-1.5",
        wide ? "w-96" : "w-64",
        state === "skipped" && "opacity-40"
      )}
    >
      {nodeId && !readOnly ? (
        <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
          <div className="flex gap-1 rounded-2xl bg-card p-1 ring-1 ring-foreground/10">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Node settings"
              onClick={() => openSettings(nodeId)}
            >
              <Settings2 />
            </Button>
            {kind === "trigger" ? null : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Duplicate node"
                  onClick={() => duplicate(nodeId)}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete node"
                  onClick={() => remove(nodeId)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </NodeToolbar>
      ) : null}
      <div className="flex min-h-6 items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="flex-1">{KIND_LABEL[kind]}</span>
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
      </div>
    </div>
  )
}

/** The inset field block used for prompts, names and rows. */
export const FIELD = "rounded-2xl bg-muted/60 p-3"
export const BARE_INPUT =
  "nodrag nowheel w-full border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
