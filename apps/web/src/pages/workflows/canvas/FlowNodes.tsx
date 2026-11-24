import type { NodeProps } from "@xyflow/react"
import { cn } from "@workspace/ui/lib/utils"
import { useFlow } from "./flow-context"
import type { CanvasNodeData } from "./flow-kinds"
import { FIELD, NodeShell, PortHandle } from "./NodeShell"
import { ModelRow } from "./ModelRow"
import { ConnectorCount } from "./StepConnectors"
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

function hasModel(kind: string): boolean {
  return kind === "agent" || kind === "llm" || kind === "judge"
}

function hasAllowLists(kind: string): boolean {
  return kind === "agent" || kind === "llm"
}

/** Generic step card (agent, command, llm, prompt). */
export function StepNode({ id, data, selected }: Props) {
  const kind = data.kind
  const { update, readOnly } = useFlow()
  return (
    <NodeShell
      kind={kind}
      wide
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <InPorts kind={kind} />
      <Body data={data} />
      {hasModel(kind) && !readOnly ? (
        <ModelRow
          cli={data.cli}
          model={data.model}
          effort={data.effort}
          onChange={(p) => update(id, p)}
        />
      ) : null}
      {hasAllowLists(kind) ? (
        <ConnectorCount
          id={id}
          connectors={data.connectors}
          skills={data.skills}
        />
      ) : null}
      <OutPorts kind={kind} />
    </NodeShell>
  )
}

/** Judge: yes/no out ports as separate rows. */
export function JudgeNode({ id, data, selected }: Props) {
  const { update, readOnly } = useFlow()
  return (
    <NodeShell
      kind="judge"
      wide
      selected={selected}
      state={data.state}
      result={
        data.result === "yes" || data.result === "no" ? undefined : data.result
      }
    >
      <InPorts kind="judge" />
      <Body data={data} />
      {!readOnly ? (
        <ModelRow
          cli={data.cli}
          model={data.model}
          effort={data.effort}
          onChange={(p) => update(id, p)}
        />
      ) : null}
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
