import type { NodeProps } from "@xyflow/react"
import { cn } from "@workspace/ui/lib/utils"
import { useFlow } from "./flow-context"
import { FIELD, KindPorts, NodeShell, PortHandle } from "./NodeShell"
import { NodeFileField, NodeYamlField } from "./NodeFields"
import { ModelRow } from "./ModelRow"
import { ConnectorCount } from "./StepConnectors"
import { portsFor, type CanvasNode } from "./flow-graph"

type Props = NodeProps<CanvasNode>

function Ports({ kind }: { kind: string }) {
  const p = portsFor(kind)
  return <KindPorts ins={p.in} outs={p.branches?.length ? [] : p.out} />
}

/** Prompt: fixed text that feeds the next steps. */
export function PromptNode({ id, data, selected }: Props) {
  return (
    <NodeShell
      kind="prompt"
      name={data.name}
      wide
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="prompt" />
      <NodeFileField
        nodeId={id}
        file="text.md"
        label="Prompt text"
        placeholder="Write the text this prompt passes on"
        rows={4}
      />
    </NodeShell>
  )
}

/** LLM (and the retired Agent): instructions, model, connectors, skills. */
export function LlmNode({ id, data, selected }: Props) {
  const kind = data.kind
  const { update, readOnly } = useFlow()
  return (
    <NodeShell
      kind={kind}
      name={data.name}
      wide
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind={kind} />
      <NodeFileField
        nodeId={id}
        file="prompt.md"
        label="Instructions"
        placeholder="What should the model do with its inputs?"
        rows={4}
      />
      {!readOnly ? (
        <ModelRow
          cli={data.cli}
          model={data.model}
          effort={data.effort}
          onChange={(p) => update(id, p)}
        />
      ) : null}
      <ConnectorCount
        id={id}
        connectors={data.connectors}
        skills={data.skills}
      />
    </NodeShell>
  )
}

/** Command: one shell line. */
export function CommandNode({ id, data, selected }: Props) {
  const { update } = useFlow()
  return (
    <NodeShell
      kind="command"
      name={data.name}
      wide
      selected={selected}
      state={data.state}
      result={data.result}
    >
      <Ports kind="command" />
      <NodeYamlField
        value={data.run ?? ""}
        label="Command"
        placeholder="echo ok"
        rows={2}
        mono
        testId="node-field-run"
        onCommit={(run) => run && update(id, { run })}
      />
    </NodeShell>
  )
}

/** Judge: a rule the model answers yes or no; one out port per branch. */
export function JudgeNode({ id, data, selected }: Props) {
  const { update, readOnly } = useFlow()
  const rule = data.mode !== "check"
  return (
    <NodeShell
      kind="judge"
      name={data.name}
      wide
      selected={selected}
      state={data.state}
      result={
        data.result === "yes" || data.result === "no" ? undefined : data.result
      }
    >
      <Ports kind="judge" />
      {rule ? (
        <NodeFileField
          nodeId={id}
          file="rule.md"
          label="Rule"
          placeholder="Answer yes when…"
          rows={3}
        />
      ) : (
        <p className={cn(FIELD, "text-sm text-muted-foreground")}>
          Checks an upstream answer
        </p>
      )}
      {rule && !readOnly ? (
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
          <PortHandle io="out" port="text" id={b} inset={8} />
        </div>
      ))}
    </NodeShell>
  )
}
