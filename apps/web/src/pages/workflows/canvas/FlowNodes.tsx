import type { NodeProps } from "@xyflow/react"
import { cn } from "@workspace/ui/lib/utils"
import type { CanvasNodeData } from "./flow-kinds"
import { FIELD, NodeShell, PortHandle } from "./NodeShell"
import { portsFor, type CanvasNode } from "./flow-graph"

type Props = NodeProps<CanvasNode>

function Body({ data }: { data: CanvasNodeData }) {
  const title = data.name ?? data.summary
  return (
    <div className={cn(FIELD, "space-y-1 text-sm")}>
      {title ? <p className="font-medium">{title}</p> : null}
      {data.name && data.summary && data.summary !== data.name ? (
        <p className="text-xs text-muted-foreground">{data.summary}</p>
      ) : null}
      {!title ? (
        <p className="text-xs text-muted-foreground">No details yet</p>
      ) : null}
    </div>
  )
}

function InPorts({ kind }: { kind: string }) {
  const ports = portsFor(kind).in
  return (
    <>
      {ports.map((port, i) => (
        <PortHandle key={port} io="in" port={port} top={36 + i * 48} />
      ))}
    </>
  )
}

function OutPorts({ kind }: { kind: string }) {
  const ports = portsFor(kind)
  if (ports.branches?.length) {
    return null
  }
  return (
    <>
      {ports.out.map((port, i) => (
        <PortHandle key={port} io="out" port={port} top={36 + i * 48} />
      ))}
    </>
  )
}

/** Generic step card (agent, command, llm, prompt). */
export function StepNode({ data, selected }: Props) {
  const kind = data.kind
  return (
    <NodeShell kind={kind} wide selected={selected} state={data.state}>
      <InPorts kind={kind} />
      <Body data={data} />
      <OutPorts kind={kind} />
    </NodeShell>
  )
}

/** Judge: yes/no out ports as separate rows. */
export function JudgeNode({ data, selected }: Props) {
  return (
    <NodeShell kind="judge" wide selected={selected} state={data.state}>
      <InPorts kind="judge" />
      <Body data={data} />
      {(["yes", "no"] as const).map((b) => (
        <div
          key={b}
          className={cn(
            "relative rounded-2xl bg-muted/60 px-3 py-2 text-sm",
            data.result === b && "ring-1 ring-success/40"
          )}
        >
          {b === "yes" ? "Yes" : "No"}
          <PortHandle io="out" port="text" id={b} gap={24} />
        </div>
      ))}
    </NodeShell>
  )
}
