import { useState } from "react"
import type { WorkflowInputDecl } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { inputProblem } from "./node-sheet"

type Props = {
  row: WorkflowInputDecl
  others: readonly WorkflowInputDecl[]
  onSave: (row: WorkflowInputDecl) => void
  onClose: () => void
}

/** Edit input dialog, 448px (DES-036). Applies on Done, so YAML stays valid. */
export function InputEditDialog({ row, others, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(row)
  const problem = inputProblem(draft, others)
  const patch = (p: Partial<WorkflowInputDecl>) =>
    setDraft((d) => ({ ...d, ...p }) as WorkflowInputDecl)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="input-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit input</DialogTitle>
          <DialogDescription>
            Asked for on the start form and passed to the run.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="input-edit-name">Name</FieldLabel>
            <Input
              id="input-edit-name"
              data-testid="input-edit-name"
              aria-invalid={problem ? true : undefined}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {problem ? <FieldError>{problem}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select
              value={draft.type}
              onValueChange={(type) => {
                if (type === "text" || type === "markdown" || type === "file") {
                  patch(type === "file" ? { type, default: undefined } : { type })
                }
              }}
            >
              <SelectTrigger data-testid="input-edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">text</SelectItem>
                <SelectItem value="markdown">markdown</SelectItem>
                <SelectItem value="file">file</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="input-edit-required">Required</FieldLabel>
            <Switch
              id="input-edit-required"
              data-testid="input-edit-required"
              checked={draft.required}
              onCheckedChange={(required) => patch({ required })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="input-edit-desc">Description</FieldLabel>
            <Textarea
              id="input-edit-desc"
              data-testid="input-edit-desc"
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) =>
                patch({ description: e.target.value || undefined })
              }
            />
          </Field>
          {draft.type !== "file" ? (
            <Field>
              <FieldLabel htmlFor="input-edit-default">Default</FieldLabel>
              <Input
                id="input-edit-default"
                data-testid="input-edit-default"
                value={draft.default ?? ""}
                onChange={(e) => patch({ default: e.target.value || undefined })}
              />
            </Field>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="input-edit-done"
            disabled={problem !== null}
            onClick={() => onSave(draft)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
