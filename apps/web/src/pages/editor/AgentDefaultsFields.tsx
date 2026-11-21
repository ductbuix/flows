import type { Effort, WorkflowAgent } from "@workspace/shared"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useCliModels } from "@/hooks/use-cli-models"

type Props = {
  agent: WorkflowAgent | undefined
  onChange: (agent: WorkflowAgent | undefined) => void
}

/** Per-CLI model and effort defaults on the workflow (DES-023). */
export function AgentDefaultsFields({ agent, onChange }: Props) {
  const claude = useCliModels("claude")
  const cursor = useCliModels("cursor")

  function setCli(
    cli: "claude" | "cursor",
    field: "model" | "effort",
    value: string | Effort | undefined
  ) {
    const cur: { model?: string; effort?: Effort } = { ...agent?.[cli] }
    if (field === "model") {
      if (value === undefined) delete cur.model
      else cur.model = value
    } else if (value === undefined) {
      delete cur.effort
    } else {
      cur.effort = value as Effort
    }

    const next: WorkflowAgent = { ...agent }
    if (cur.model === undefined && cur.effort === undefined) delete next[cli]
    else next[cli] = cur

    onChange(
      next.claude === undefined && next.cursor === undefined ? undefined : next
    )
  }

  return (
    <FieldSet data-testid="agent-defaults">
      <FieldLegend variant="label">Agent defaults</FieldLegend>
      <FieldDescription>
        Used when a task or judge omits model or effort.
      </FieldDescription>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel>Claude</FieldLabel>
          <ModelSelector
            catalog={claude.catalog}
            model={agent?.claude?.model}
            effort={agent?.claude?.effort}
            onChangeModel={(model) => setCli("claude", "model", model)}
            onChangeEffort={(effort) => setCli("claude", "effort", effort)}
          />
        </Field>
        <Field>
          <FieldLabel>Cursor</FieldLabel>
          <ModelSelector
            catalog={cursor.catalog}
            model={agent?.cursor?.model}
            effort={agent?.cursor?.effort}
            onChangeModel={(model) => setCli("cursor", "model", model)}
            onChangeEffort={(effort) => setCli("cursor", "effort", effort)}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}
