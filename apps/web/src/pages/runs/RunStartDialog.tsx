import { useState } from "react"
import { Play } from "lucide-react"
import type { WorkflowSummary } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { workflowLabel } from "@/lib/labels"
import { startRun } from "./run-actions"

type Props = {
  open: boolean
  workflows: WorkflowSummary[]
  onOpenChange: (open: boolean) => void
  onStarted: (runId: string) => void
  onConflict: () => void
  onError: (message: string) => void
}

export function RunStartDialog({
  open,
  workflows,
  onOpenChange,
  onStarted,
  onConflict,
  onError,
}: Props) {
  const client = useFlowsClient()
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const workflow = workflows.find((w) => w.id === workflowId)

  function close(next: boolean) {
    if (!next) {
      setWorkflowId(null)
      setPending(false)
    }
    onOpenChange(next)
  }

  async function start() {
    if (!workflow) return
    setPending(true)
    const result = await startRun(client, { workflowId: workflow.id })
    setPending(false)
    if (result.ok && result.runId) {
      close(false)
      onStarted(result.runId)
      return
    }
    if (!result.ok && result.kind === "conflict") onConflict()
    else if (!result.ok) onError(result.message)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="runs-start-dialog">
        <DialogHeader>
          <DialogTitle>Start a run</DialogTitle>
          <DialogDescription>
            Pick a workflow. Running again starts a new attempt.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Workflow</FieldLabel>
          <Select
            value={workflowId}
            items={workflows.map((w) => ({
              value: w.id,
              label: workflowLabel(w),
            }))}
            onValueChange={(v) => v && setWorkflowId(v)}
          >
            <SelectTrigger data-testid="runs-start-workflow">
              <SelectValue placeholder="Choose a workflow" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {workflowLabel(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workflow?.goal ? (
            <p className="text-xs text-muted-foreground">{workflow.goal}</p>
          ) : null}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!workflow || pending}
            onClick={() => void start()}
            data-testid="runs-start-submit"
          >
            <Play />
            Start run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
