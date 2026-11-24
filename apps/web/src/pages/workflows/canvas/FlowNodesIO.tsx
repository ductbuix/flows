import { Bell, FileText, MousePointerClick } from "lucide-react"
import type { NodeProps } from "@xyflow/react"
import { cn } from "@workspace/ui/lib/utils"
import { FIELD, NodeShell, PortHandle } from "./NodeShell"
import { portsFor, type CanvasNode } from "./flow-graph"

type Props = NodeProps<CanvasNode>

function OutPorts({ kind }: { kind: string }) {
  return (
    <>
      {portsFor(kind).out.map((port, i) => (
        <PortHandle key={port} io="out" port={port} top={36 + i * 48} />
      ))}
    </>
  )
}

function InPorts({ kind }: { kind: string }) {
  return (
    <>
      {portsFor(kind).in.map((port, i) => (
        <PortHandle key={port} io="in" port={port} top={36 + i * 48} />
      ))}
    </>
  )
}

/** Manual start of a workflow. */
export function TriggerNode({ data, selected }: Props) {
  return (
    <NodeShell kind="trigger" selected={selected} state={data.state}>
      <div className={cn(FIELD, "flex items-center gap-2 text-sm font-medium")}>
        <MousePointerClick className="size-4 text-warning" />
        Manual
      </div>
      <OutPorts kind="trigger" />
    </NodeShell>
  )
}

/** Library resources pinned into the run. */
export function AssetNode({ data, selected }: Props) {
  return (
    <NodeShell kind="asset" selected={selected} state={data.state}>
      <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-muted/60 text-muted-foreground">
        <FileText className="size-8" />
        {data.summary ? (
          <span className="max-w-full truncate px-3 text-xs">
            {data.summary}
          </span>
        ) : null}
      </div>
      <OutPorts kind="asset" />
    </NodeShell>
  )
}

/** Pauses until a person approves or rejects. */
export function ApprovalNode({ data, selected }: Props) {
  return (
    <NodeShell kind="approval" selected={selected} state={data.state}>
      <InPorts kind="approval" />
      <div className={FIELD}>
        <p className="text-sm">
          {data.question || data.summary || "Ask before continuing"}
        </p>
      </div>
      <OutPorts kind="approval" />
    </NodeShell>
  )
}

/** Ends a branch (notify / folder / publish). */
export function OutputNode({ data, selected }: Props) {
  return (
    <NodeShell kind="output" selected={selected} state={data.state}>
      <InPorts kind="output" />
      <div className={cn(FIELD, "flex flex-col gap-2")}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="size-4 text-info" />
          {data.title || data.summary || "Output"}
        </div>
      </div>
    </NodeShell>
  )
}
