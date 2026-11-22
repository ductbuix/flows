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
import { workflowIdSchema } from "@workspace/shared"
import { api } from "@/lib/api"
import { mono } from "@/components/data/mono"

/** "Feature Spec!" becomes "feature-spec". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function CreateWorkflowDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("")
  const [id, setId] = useState("")
  const [idEdited, setIdEdited] = useState(false)
  const [goal, setGoal] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    const parsed = workflowIdSchema.safeParse(id.trim())
    if (!parsed.success) {
      setError("Id must be lowercase letters, digits and dashes.")
      return
    }
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!goal.trim()) {
      setError("Goal is required.")
      return
    }
    setBusy(true)
    try {
      const res = await api.workflows.$post({
        json: { id: parsed.data, name: name.trim(), goal: goal.trim() },
      })
      if (res.status === 409) {
        setError("A workflow with that id already exists.")
        return
      }
      if (!res.ok) {
        setError("Could not create workflow.")
        return
      }
      onCreated(parsed.data)
      setName("")
      setId("")
      setIdEdited(false)
      setGoal("")
      onOpenChange(false)
    } catch {
      setError("Could not create workflow.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="workflow-create">
        <DialogHeader>
          <DialogTitle>Create workflow</DialogTitle>
          <DialogDescription>
            Creates a new directory under workflows/ with workflow.yaml and
            empty memory, input and output folders.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="create-name">Name</FieldLabel>
          <Input
            id="create-name"
            data-testid="create-name-input"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value)
              if (!idEdited) setId(slugify(e.target.value))
            }}
            placeholder="My workflow"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="create-id">Folder id</FieldLabel>
          <Input
            id="create-id"
            data-testid="create-id-input"
            className={mono}
            value={id}
            onChange={(e) => {
              setId(e.target.value)
              setIdEdited(true)
            }}
            placeholder="my-workflow"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="create-goal">Goal</FieldLabel>
          <Textarea
            id="create-goal"
            data-testid="create-goal-input"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
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
            data-testid="create-submit"
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
