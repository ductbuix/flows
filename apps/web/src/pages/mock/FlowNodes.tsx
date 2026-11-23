import { Play } from "lucide-react"
import type { NodeProps } from "@xyflow/react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useFlow } from "./flow-context"
import type { FlowNode } from "./flow-data"
import { ModelRow } from "./ModelRow"
import { ConnectorCount } from "./StepConnectors"
import { BARE_INPUT, FIELD, NodeShell, PortHandle } from "./NodeShell"

function RunButton({ id }: { id: string }) {
  const { run, readOnly } = useFlow()
  if (readOnly) return null
  return (
    <Button className="nodrag w-full" onClick={() => run(id)}>
      Run
      <Play />
    </Button>
  )
}

function Result({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className={cn(FIELD, "nowheel max-h-28 overflow-auto text-xs text-muted-foreground")}>
      {text}
    </div>
  )
}

/** Prompt, model and a result; LLM takes text and images, gives text. */
export function LlmNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { update } = useFlow()
  return (
    <NodeShell kind="llm" wide selected={selected} state={data.state}>
      <PortHandle io="in" port="text" top={36} />
      <PortHandle io="in" port="image" top={84} />
      <div className={FIELD}>
        <Textarea
          aria-label="Prompt"
          placeholder="What should the model do?"
          rows={3}
          className={cn(BARE_INPUT, "min-h-16 resize-none")}
          value={data.prompt ?? ""}
          onChange={(e) => update(id, { prompt: e.target.value })}
        />
        <ModelRow data={data} onChange={(p) => update(id, p)} />
      </div>
      <ConnectorCount id={id} ids={data.connectors ?? []} skills={data.skills ?? []} />
      <Result text={data.result} />
      <RunButton id={id} />
      <PortHandle io="out" port="text" />
    </NodeShell>
  )
}

/** Like LLM, but the answer is yes or no and each answer is its own port. */
export function ConditionNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { update } = useFlow()
  return (
    <NodeShell kind="condition" wide selected={selected} state={data.state}>
      <PortHandle io="in" port="text" top={36} />
      <div className={FIELD}>
        <Textarea
          aria-label="Condition"
          placeholder="What should be true to say yes?"
          rows={2}
          className={cn(BARE_INPUT, "min-h-10 resize-none")}
          value={data.prompt ?? ""}
          onChange={(e) => update(id, { prompt: e.target.value })}
        />
        <ModelRow data={data} onChange={(p) => update(id, p)} />
      </div>
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
      <RunButton id={id} />
    </NodeShell>
  )
}
