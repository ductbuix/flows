import { useState } from "react"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import type { AnswerDecl } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { AnswerEditDialog } from "./AnswerEditDialog"
import { nextAnswerName } from "./node-sheet"

type Props = {
  answers: readonly AnswerDecl[]
  onChange: (answers: AnswerDecl[] | undefined) => void
}

const MAX_ANSWERS = 20

/** The named answers of an Agent or LLM node (DES-032), up to 20. */
export function AnswersEditor({ answers, onChange }: Props) {
  // `index === answers.length` is a new row.
  const [editing, setEditing] = useState<number | null>(null)
  const commit = (next: AnswerDecl[]) => onChange(next.length ? next : undefined)
  const editedRow =
    editing === null
      ? null
      : (answers[editing] ?? {
          name: nextAnswerName(answers),
          type: "text" as const,
        })

  return (
    <FieldSet data-testid="node-answers">
      <div className="flex items-center justify-between gap-2">
        <FieldLegend variant="label">Answers</FieldLegend>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="answer-add"
          disabled={answers.length >= MAX_ANSWERS}
          onClick={() => setEditing(answers.length)}
        >
          <PlusIcon data-icon="inline-start" />
          Add answer
        </Button>
      </div>
      {answers.length === 0 ? (
        <FieldDescription>
          No named answers. Declare some to use them as {"{{"}name{"}}"} in later
          steps.
        </FieldDescription>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {answers.map((row, i) => (
            <li key={row.name}>
              <Field
                orientation="horizontal"
                className="items-center rounded-md border px-2 py-1.5"
                data-testid={`answer-row-${row.name}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{row.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.type === "yesno" ? "yes or no" : row.type}
                    {row.labels ? `: ${row.labels.join(", ")}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${row.name}`}
                  data-testid={`answer-edit-${row.name}`}
                  onClick={() => setEditing(i)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${row.name}`}
                  data-testid={`answer-remove-${row.name}`}
                  onClick={() => commit(answers.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              </Field>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && editedRow ? (
        <AnswerEditDialog
          key={editing}
          row={editedRow}
          others={answers.filter((_, j) => j !== editing)}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            const next = [...answers]
            next[editing] = row
            commit(next)
            setEditing(null)
          }}
        />
      ) : null}
    </FieldSet>
  )
}
