import { useEffect, useState } from "react"
import { Play } from "lucide-react"
import type { DocketRef, WorkflowSummary } from "@workspace/contracts"
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
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { workflowLabel } from "@/lib/labels"
import { startRun } from "@/components/runs/run-actions"

type CardFace = {
  id: string
  title: string
  refs: DocketRef[]
  assetNames: string[]
}

/** Best guess of an input's value from what the card already holds. */
function guess(input: string, card: CardFace): string {
  const key = input.toLowerCase()
  if (key.includes("ticket") || key.includes("story")) {
    return card.refs[0]?.id ?? card.refs[0]?.label ?? ""
  }
  if (key.includes("file") || key.includes("changelog")) {
    return card.assetNames[0] ?? ""
  }
  if (key.includes("version")) {
    return card.title.match(/v?\d+(\.\d+)+/)?.[0] ?? ""
  }
  return card.title
}

function triggerInputNames(
  workflow: { nodes: { kind: string; inputs?: { name: string }[] }[] } | null
): string[] {
  const trigger = workflow?.nodes.find((n) => n.kind === "trigger")
  return trigger?.inputs?.map((i) => i.name) ?? []
}

type Props = {
  card: CardFace
  open: boolean
  workflows: WorkflowSummary[]
  onOpenChange: (open: boolean) => void
  onStarted: (runId: string) => void
  onConflict: () => void
  onError: (message: string) => void
}

export function RunWorkflowDialog({
  card,
  open,
  workflows,
  onOpenChange,
  onStarted,
  onConflict,
  onError,
}: Props) {
  const client = useFlowsClient()
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [inputNames, setInputNames] = useState<string[]>([])
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const workflow = workflows.find((w) => w.id === workflowId)

  useEffect(() => {
    if (!open || !workflowId) return
    let alive = true
    void client.call("workflow/get", { id: workflowId }).then(
      (detail) => {
        if (alive) setInputNames(triggerInputNames(detail.workflow))
      },
      () => {
        if (alive) setInputNames([])
      }
    )
    return () => {
      alive = false
    }
  }, [client, open, workflowId])

  function pickWorkflow(id: string | null) {
    setWorkflowId(id)
    setInputNames([])
    setEdits({})
  }

  function close(next: boolean) {
    if (!next) {
      pickWorkflow(null)
      setPending(false)
    }
    onOpenChange(next)
  }

  async function start() {
    if (!workflow) return
    setPending(true)
    const values = Object.fromEntries(
      inputNames.map((name) => [
        name,
        edits[`${workflow.id}:${name}`] ?? guess(name, card),
      ])
    )
    const result = await startRun(client, {
      workflowId: workflow.id,
      workItemId: card.id,
      ...(inputNames.length > 0 ? { values } : {}),
    })
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
            items={workflows.map((w) => ({
              value: w.id,
              label: workflowLabel(w),
            }))}
            onValueChange={(v) => v && pickWorkflow(v)}
          >
            <SelectTrigger data-testid="card-run-workflow">
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
        {workflow &&
          inputNames.map((name) => (
            <Field key={name}>
              <FieldLabel htmlFor={`rw-${name}`}>{name}</FieldLabel>
              <Input
                id={`rw-${name}`}
                data-testid={`card-run-input-${name}`}
                value={edits[`${workflow.id}:${name}`] ?? guess(name, card)}
                onChange={(e) =>
                  setEdits((p) => ({
                    ...p,
                    [`${workflow.id}:${name}`]: e.target.value,
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
            disabled={!workflow || pending}
            onClick={() => void start()}
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
