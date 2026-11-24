import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { Card } from "./docket-data"
import { useLibrary } from "./library-store"
import { startRun } from "./runs-store"
import { useWorkflows } from "./workflows-store"

/** Best guess of an input's value from what the card already holds. */
function guess(input: string, card: Card, file: string): string {
  const key = input.toLowerCase()
  if (key.includes("ticket") || key.includes("story"))
    return card.refs[0]?.id ?? card.refs[0]?.label ?? ""
  if (key.includes("file") || key.includes("changelog")) return file
  if (key.includes("version"))
    return card.title.match(/v?\d+(\.\d+)+/)?.[0] ?? ""
  return card.title
}

type Props = {
  card: Card
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RunWorkflowDialog({ card, open, onOpenChange }: Props) {
  const workflows = useWorkflows()
  const file =
    useLibrary().find((i) => i.usedBy.includes(card.id))?.assets[0]?.name ?? ""
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const workflow = workflows.find((w) => w.id === workflowId)

  function close(next: boolean) {
    if (!next) {
      setWorkflowId(null)
      setEdits({})
    }
    onOpenChange(next)
  }

  function start() {
    if (!workflow) return
    const inputs = Object.fromEntries(
      workflow.inputs.map((i) => [
        i,
        edits[`${workflow.id}:${i}`] ?? guess(i, card, file),
      ])
    )
    startRun(workflow.id, card.id, inputs)
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="card-run-dialog">
        <DialogHeader>
          <DialogTitle>Run a workflow</DialogTitle>
          <DialogDescription>
            Solve this card with a workflow. Inputs are filled from the card;
            change them if needed. Running again starts the next attempt.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Workflow</FieldLabel>
          <Select
            value={workflowId}
            items={workflows.map((w) => ({ value: w.id, label: w.name }))}
            onValueChange={(v) => setWorkflowId(v)}
          >
            <SelectTrigger data-testid="card-run-workflow">
              <SelectValue placeholder="Choose a workflow" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workflow ? (
            <p className="text-xs text-muted-foreground">{workflow.solves}</p>
          ) : null}
        </Field>
        {workflow?.inputs.map((i) => (
          <Field key={i}>
            <FieldLabel htmlFor={`rw-${i}`}>{i}</FieldLabel>
            <Input
              id={`rw-${i}`}
              value={edits[`${workflow.id}:${i}`] ?? guess(i, card, file)}
              onChange={(e) =>
                setEdits((p) => ({
                  ...p,
                  [`${workflow.id}:${i}`]: e.target.value,
                }))
              }
            />
          </Field>
        ))}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!workflow}
            onClick={start}
            data-testid="card-run-start"
          >
            <Play />
            Start run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
