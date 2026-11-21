import type { WorkflowInputDecl, WorkflowLimits } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { InputDeclRow } from "./InputDeclRow"

type Props = {
  inputs: WorkflowInputDecl[] | undefined
  limits: WorkflowLimits | undefined
  onChangeInputs: (inputs: WorkflowInputDecl[] | undefined) => void
  onChangeLimits: (limits: WorkflowLimits | undefined) => void
}

function nextInputName(existing: WorkflowInputDecl[]): string {
  const used = new Set(existing.map((d) => d.name))
  for (let n = 1; n < 100; n++) {
    const name = `input${n}`
    if (!used.has(name)) return name
  }
  return `input${Date.now()}`
}

export function InputsPanel({
  inputs,
  limits,
  onChangeInputs,
  onChangeLimits,
}: Props) {
  const list = inputs ?? []

  function patchInput(index: number, patch: Partial<WorkflowInputDecl>) {
    const next = list.map((row, i) =>
      i === index ? ({ ...row, ...patch } as WorkflowInputDecl) : row
    )
    onChangeInputs(next.length ? next : undefined)
  }

  function removeInput(index: number) {
    const next = list.filter((_, i) => i !== index)
    onChangeInputs(next.length ? next : undefined)
  }

  function addInput() {
    const row: WorkflowInputDecl = {
      name: nextInputName(list),
      type: "text",
      required: false,
    }
    onChangeInputs([...list, row])
  }

  const maxRuns = limits?.maxConcurrentRuns

  return (
    <>
      <Separator />
      <FieldSet data-testid="inputs-panel">
        <div className="flex items-center justify-between gap-2">
          <FieldLegend variant="label">Inputs</FieldLegend>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="input-add"
            onClick={addInput}
          >
            Add input
          </Button>
        </div>

        {list.length === 0 ? (
          <FieldDescription>
            No declared inputs. The start form uses defaults only.
          </FieldDescription>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((row, index) => (
              <InputDeclRow
                key={`${index}-${row.name}`}
                index={index}
                row={row}
                onPatch={(patch) => patchInput(index, patch)}
                onRemove={() => removeInput(index)}
              />
            ))}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="field-max-concurrent-runs">
            Max concurrent runs
          </FieldLabel>
          <Input
            id="field-max-concurrent-runs"
            data-testid="field-max-concurrent-runs"
            type="number"
            min={1}
            step={1}
            placeholder="1 (default)"
            value={maxRuns ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim()
              const base = { ...limits }
              if (raw === "") {
                delete base.maxConcurrentRuns
                onChangeLimits(Object.keys(base).length ? base : undefined)
                return
              }
              const n = Number(raw)
              if (!Number.isInteger(n) || n < 1) return
              onChangeLimits({ ...base, maxConcurrentRuns: n })
            }}
          />
          <FieldDescription>
            Extra starts queue when at the limit. Leave empty for 1.
          </FieldDescription>
        </Field>
      </FieldSet>
    </>
  )
}
