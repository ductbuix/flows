import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { workItemDetailSchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { useWorkflows } from "@/lib/workflows-context"

const NONE = "__none__"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function CreateWorkItemDialog({ open, onOpenChange, onCreated }: Props) {
  const { workflows } = useWorkflows()
  const [title, setTitle] = useState("")
  const [workflowId, setWorkflowId] = useState(NONE)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setTitle("")
    setWorkflowId(NONE)
    setNotes("")
    setError(null)
  }

  async function submit() {
    setError(null)
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    setBusy(true)
    try {
      const res = await api.workitems.$post({
        json: {
          title: title.trim(),
          ...(workflowId !== NONE ? { workflowId } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      })
      if (!res.ok) {
        setError("Could not create work item.")
        return
      }
      const detail = workItemDetailSchema.parse(await res.json())
      onCreated(detail.item.id)
      reset()
      onOpenChange(false)
    } catch {
      setError("Could not create work item.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="work-item-create">
        <DialogHeader>
          <DialogTitle>New work item</DialogTitle>
          <DialogDescription>
            Create an ad hoc work item. Optionally pick a default workflow and
            starting notes.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="wi-title">Title</FieldLabel>
          <Input
            id="wi-title"
            data-testid="work-item-create-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story or request title"
          />
        </Field>
        <Field>
          <FieldLabel>Workflow</FieldLabel>
          <Select
            value={workflowId}
            onValueChange={(v) => v && setWorkflowId(v)}
          >
            <SelectTrigger data-testid="work-item-create-workflow">
              <SelectValue placeholder="Optional workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {(workflows ?? []).map((wf) => (
                <SelectItem key={wf.id} value={wf.id}>
                  {wf.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="wi-notes">Notes</FieldLabel>
          <Textarea
            id="wi-notes"
            data-testid="work-item-create-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes"
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="work-item-create-submit"
            disabled={busy}
            onClick={() => void submit()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
