import type {
  Workflow,
  WorkflowAgent,
  WorkflowInputDecl,
  WorkflowLimits,
} from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { humanizeId } from "@/lib/labels"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { AgentDefaultsFields } from "./AgentDefaultsFields"
import { InputsPanel } from "./InputsPanel"
import { MemoryPanel } from "./MemoryPanel"

type Props = {
  workflowId: string
  workflow: Workflow
  onChangeName: (name: string) => void
  onChangeGoal: (goal: string) => void
  onChangeInputs: (inputs: WorkflowInputDecl[] | undefined) => void
  onChangeLimits: (limits: WorkflowLimits | undefined) => void
  onChangeAgent: (agent: WorkflowAgent | undefined) => void
}

/** Workflow-level inspector when no task is selected. */
export function InspectorWorkflowPanel({
  workflowId,
  workflow,
  onChangeName,
  onChangeGoal,
  onChangeInputs,
  onChangeLimits,
  onChangeAgent,
}: Props) {
  return (
    <div className="overflow-auto p-4" data-testid="inspector">
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Workflow</FieldLegend>
          <Field>
            <FieldLabel htmlFor="field-name">Name</FieldLabel>
            <Input
              id="field-name"
              data-testid="field-name"
              value={workflow.name ?? ""}
              maxLength={80}
              placeholder={humanizeId(workflowId)}
              onChange={(e) => onChangeName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="field-goal">Goal</FieldLabel>
            <Textarea
              id="field-goal"
              data-testid="field-goal"
              value={workflow.goal ?? ""}
              onChange={(e) => onChangeGoal(e.target.value)}
              rows={3}
            />
          </Field>
        </FieldSet>
        <InputsPanel
          inputs={workflow.inputs}
          limits={workflow.limits}
          onChangeInputs={onChangeInputs}
          onChangeLimits={onChangeLimits}
        />
        <AgentDefaultsFields agent={workflow.agent} onChange={onChangeAgent} />
        <FieldDescription>Select a task to edit its fields.</FieldDescription>
        <MemoryPanel workflowId={workflowId} />
      </FieldGroup>
    </div>
  )
}
