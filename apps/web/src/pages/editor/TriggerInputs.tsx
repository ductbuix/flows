import { useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import type { WorkflowInputDecl } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { InputEditDialog } from "./InputEditDialog"
import { nextInputName } from "./node-sheet"

type Props = {
  inputs: readonly WorkflowInputDecl[]
  onChange: (inputs: WorkflowInputDecl[] | undefined) => void
}

/** The Trigger's run inputs (DES-021), moved here from workflow settings. */
export function TriggerInputs({ inputs, onChange }: Props) {
  // `index === inputs.length` is a new row.
  const [editing, setEditing] = useState<number | null>(null)
  const commit = (next: WorkflowInputDecl[]) =>
    onChange(next.length ? next : undefined)
  const editedRow =
    editing === null
      ? null
      : (inputs[editing] ?? {
          name: nextInputName(inputs),
          type: "text" as const,
          required: false,
        })

  return (
    <FieldSet data-testid="trigger-inputs">
      <div className="flex items-center justify-between gap-2">
        <FieldLegend variant="label">Inputs</FieldLegend>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="input-add"
          onClick={() => setEditing(inputs.length)}
        >
          <PlusIcon data-icon="inline-start" />
          Add input
        </Button>
      </div>
      {inputs.length === 0 ? (
        <FieldDescription>
          No declared inputs. The start form uses defaults only.
        </FieldDescription>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {inputs.map((row, i) => (
            <li key={row.name}>
              <Field
                orientation="horizontal"
                className="items-center rounded-md border px-2 py-1.5"
                data-testid={`input-row-${row.name}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {row.name}
                  </span>
                  <span className="flex gap-1.5 text-xs text-muted-foreground">
                    {row.type}
                    {row.required ? <Badge variant="outline">required</Badge> : null}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${row.name}`}
                  data-testid={`input-edit-${row.name}`}
                  onClick={() => setEditing(i)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${row.name}`}
                  data-testid={`input-remove-${row.name}`}
                  onClick={() => commit(inputs.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              </Field>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && editedRow ? (
        <InputEditDialog
          key={editing}
          row={editedRow}
          others={inputs.filter((_, j) => j !== editing)}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            const next = [...inputs]
            next[editing] = row
            commit(next)
            setEditing(null)
          }}
        />
      ) : null}
    </FieldSet>
  )
}
