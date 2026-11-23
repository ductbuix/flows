import { useState } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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

type Props = {
  open: boolean
  /** Rename mode: start from these values. */
  initial?: { name: string; solves: string }
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, solves: string) => void
}

export function NewWorkflowDialog({ open, initial, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState(initial?.name ?? "")
  const [solves, setSolves] = useState(initial?.solves ?? "")
  const [error, setError] = useState<string | null>(null)

  function close(next: boolean) {
    if (!next) {
      setName(initial?.name ?? "")
      setSolves(initial?.solves ?? "")
      setError(null)
    }
    onOpenChange(next)
  }

  function submit() {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    onCreate(name.trim(), solves.trim())
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="workflows-new">
        <DialogHeader>
          <DialogTitle>{initial ? "Rename workflow" : "New workflow"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Change the name or the type of task. The id and past runs stay the same."
              : "A workflow solves one type of task the same way every time. It starts with a manual trigger; add the rest in the editor."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="nw-name">Name</FieldLabel>
          <Input
            id="nw-name"
            data-testid="workflows-new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fix flaky test"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="nw-solves">Type of task it solves</FieldLabel>
          <Input
            id="nw-solves"
            value={solves}
            onChange={(e) => setSolves(e.target.value)}
            placeholder="A test fails intermittently on CI"
          />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button data-testid="workflows-new-submit" onClick={submit}>
            {initial ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
