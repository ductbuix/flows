import type { WorkflowNode } from "@workspace/contracts"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import { Choice } from "./node-settings-fields"
import { TriggerInputs } from "./TriggerInputs"

type Patch = Record<string, unknown>

const TARGET_OPTS = [
  { value: "notify", label: "In the app" },
  { value: "folder", label: "Run folder" },
  { value: "publish", label: "Publish" },
]

export function TriggerSettings({
  node,
  onChange,
}: {
  node: Extract<WorkflowNode, { kind: "trigger" }>
  onChange: (patch: Patch) => void
}) {
  return (
    <Field>
      <FieldLabel>Inputs a card supplies</FieldLabel>
      <TriggerInputs
        inputs={node.inputs ?? []}
        onChange={(inputs) =>
          onChange({ inputs: inputs.length === 0 ? undefined : inputs })
        }
      />
    </Field>
  )
}

export function ApprovalSettings({
  node,
  onChange,
}: {
  node: Extract<WorkflowNode, { kind: "approval" }>
  onChange: (patch: Patch) => void
}) {
  return (
    <Field>
      <FieldLabel>Question</FieldLabel>
      <Textarea
        aria-label="Question"
        rows={3}
        value={node.question}
        onChange={(e) =>
          onChange({ question: e.target.value || "Continue?" })
        }
        data-testid="node-settings-question"
      />
    </Field>
  )
}

export function OutputSettings({
  node,
  onChange,
}: {
  node: Extract<WorkflowNode, { kind: "output" }>
  onChange: (patch: Patch) => void
}) {
  return (
    <>
      <Choice
        label="Show"
        value={node.target}
        options={TARGET_OPTS}
        testId="node-settings-target"
        onChange={(target) => onChange({ target })}
      />
      {node.target === "notify" ? (
        <Field>
          <FieldLabel>Title</FieldLabel>
          <Textarea
            aria-label="Title"
            rows={2}
            value={node.title ?? ""}
            onChange={(e) =>
              onChange({ title: e.target.value.trim() || undefined })
            }
            data-testid="node-settings-title"
          />
        </Field>
      ) : null}
    </>
  )
}
