import { useState } from "react"
import type { AnswerDecl } from "@workspace/shared"
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
  FieldDescription,
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
import { answerProblem } from "./node-sheet"

type Props = {
  row: AnswerDecl
  others: readonly AnswerDecl[]
  onSave: (row: AnswerDecl) => void
  onClose: () => void
}

const TYPES: { value: AnswerDecl["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "yesno", label: "Yes or no" },
  { value: "list", label: "List" },
  { value: "choice", label: "Choice" },
]

/** Edit answer dialog, 448px. Applies on Done, so the YAML stays valid. */
export function AnswerEditDialog({ row, others, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(row)
  const [labels, setLabels] = useState((row.labels ?? []).join(", "))
  const parsedLabels = labels
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean)
  const candidate: AnswerDecl = {
    name: draft.name,
    type: draft.type,
    ...(draft.type === "choice" ? { labels: parsedLabels } : {}),
  }
  const problem = answerProblem(candidate, others)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="answer-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit answer</DialogTitle>
          <DialogDescription>
            Later steps use it as {"{{"}name{"}}"}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={problem ? true : undefined}>
            <FieldLabel htmlFor="answer-edit-name">Name</FieldLabel>
            <Input
              id="answer-edit-name"
              data-testid="answer-edit-name"
              aria-invalid={problem ? true : undefined}
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
            {problem ? <FieldError>{problem}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select
              value={draft.type}
              onValueChange={(type) => {
                const t = TYPES.find((x) => x.value === type)
                if (t) setDraft((d) => ({ ...d, type: t.value }))
              }}
            >
              <SelectTrigger data-testid="answer-edit-type">
                <SelectValue>
                  {TYPES.find((t) => t.value === draft.type)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.type === "choice" ? (
            <Field>
              <FieldLabel htmlFor="answer-edit-labels">Labels</FieldLabel>
              <Input
                id="answer-edit-labels"
                data-testid="answer-edit-labels"
                placeholder="low, high"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
              />
              <FieldDescription>Separated by commas.</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="answer-edit-done"
            disabled={problem !== null}
            onClick={() => onSave(candidate)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
