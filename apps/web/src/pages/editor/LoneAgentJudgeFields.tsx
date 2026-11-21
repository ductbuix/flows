import type { AgentJudge, Effort } from "@workspace/shared"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useCliModels } from "@/hooks/use-cli-models"

type Props = {
  /** e.g. "When judge" or "Need fetch when". */
  label: string
  judge: AgentJudge
  onChange: (judge: AgentJudge) => void
  /** Prefix for test ids, e.g. "when-". */
  idPrefix: string
}

/** Model and effort for a lone agent condition leaf (DES-023). */
export function LoneAgentJudgeFields({
  label,
  judge,
  onChange,
  idPrefix,
}: Props) {
  const { catalog } = useCliModels(judge.cli)

  return (
    <Field data-testid={`${idPrefix}judge-fields`}>
      <FieldLabel>{label}</FieldLabel>
      <ModelSelector
        catalog={catalog}
        model={judge.model}
        effort={judge.effort}
        idPrefix={idPrefix}
        onChangeModel={(model) => {
          const next: AgentJudge = { ...judge }
          if (model === undefined) delete next.model
          else next.model = model
          onChange(next)
        }}
        onChangeEffort={(effort: Effort | undefined) => {
          const next: AgentJudge = { ...judge }
          if (effort === undefined) delete next.effort
          else next.effort = effort
          onChange(next)
        }}
      />
      <FieldDescription>
        CLI {judge.cli}. Combined all/any conditions stay in YAML.
      </FieldDescription>
    </Field>
  )
}
