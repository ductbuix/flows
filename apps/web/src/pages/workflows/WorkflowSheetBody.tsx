import { useState } from "react"
import { Workflow } from "lucide-react"
import { Link, useNavigate } from "react-router"
import type { WorkflowInputDecl, WorkflowSummary } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { mono } from "@/components/data/mono"
import { workflowLabel } from "@/lib/labels"
import { InlineText } from "@/pages/docket/InlineText"
import { startRun } from "@/components/runs/run-actions"
import { TriggerInputs } from "./canvas/TriggerInputs"
import {
  renameWorkflowId,
  renameWorkflowName,
  saveWorkflowInputs,
} from "./sheet-actions"
import { WorkflowSheetRuns } from "./WorkflowSheetRuns"
import { WorkflowSheetStart } from "./WorkflowSheetStart"
import { slugify } from "./workflow-actions"

export function WorkflowSheetBody({
  workflow,
  onClose,
  onRenamedId,
}: {
  workflow: WorkflowSummary
  onClose: () => void
  onRenamedId?: (newId: string) => void
}) {
  const client = useFlowsClient()
  const navigate = useNavigate()
  const detailQ = useQuery(
    "workflow/get",
    { id: workflow.id },
    { topics: ["workflow"] }
  )
  const runsQ = useQuery(
    "run/list",
    { workflowId: workflow.id, limit: 100 },
    { topics: ["run"] }
  )
  const cardsQ = useQuery("docket/list_cards", {}, { topics: ["docket"] })
  const [cardId, setCardId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const detail = detailQ.data
  const trigger = detail?.workflow?.nodes.find((n) => n.kind === "trigger")
  const inputs: WorkflowInputDecl[] =
    trigger && "inputs" in trigger ? (trigger.inputs ?? []) : []
  const runs = runsQ.data?.items ?? []
  const cards = cardsQ.data?.items ?? []
  const title = workflowLabel(workflow)

  function report(result: "ok" | "conflict" | string) {
    if (result === "ok") {
      setConflict(false)
      setActionError(null)
      return
    }
    if (result === "conflict") setConflict(true)
    else setActionError(result)
  }

  async function onStart() {
    if (!cardId) return
    setPending(true)
    const result = await startRun(client, {
      workflowId: workflow.id,
      cardId: cardId,
    })
    setPending(false)
    if (result.ok && result.runId) {
      onClose()
      void navigate(`/workflows/${workflow.id}?run=${result.runId}`)
      return
    }
    if (!result.ok && result.kind === "conflict") setConflict(true)
    else if (!result.ok) setActionError(result.message)
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle data-testid="sheet-rename-name">
          <InlineText
            value={title}
            label="Workflow name"
            className="text-lg font-semibold"
            onSave={(name) => {
              void renameWorkflowName(client, workflow.id, name).then(report)
            }}
          />
        </SheetTitle>
        <SheetDescription className="flex flex-col gap-1">
          <div data-testid="sheet-rename-id">
            <InlineText
              value={workflow.id}
              label="Workflow id"
              className={`text-xs ${mono}`}
              onSave={(next) => {
                const newId = slugify(next).slice(0, 40) || workflow.id
                if (newId === workflow.id) return
                void renameWorkflowId(client, workflow.id, newId).then((r) => {
                  report(r)
                  if (r === "ok") onRenamedId?.(newId)
                })
              }}
            />
          </div>
          {workflow.goal ? <span>Solves: {workflow.goal}</span> : null}
        </SheetDescription>
        <Button
          variant="outline"
          className="mt-2 w-fit"
          nativeButton={false}
          render={<Link to={`/workflows/${workflow.id}`} />}
          data-testid="workflow-open-editor"
        >
          <Workflow />
          Open editor
        </Button>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t p-4">
        {(conflict || actionError) && (
          <Alert variant="destructive" data-testid="sheet-action-error">
            <AlertTitle>
              {conflict ? "Conflict" : "Could not update"}
            </AlertTitle>
            <AlertDescription>
              {conflict
                ? "This workflow changed elsewhere. Close and try again."
                : actionError}
            </AlertDescription>
          </Alert>
        )}
        <section className="flex flex-col gap-2" data-testid="sheet-inputs">
          <h3 className="text-sm font-medium">Inputs a card supplies</h3>
          {trigger ? (
            <TriggerInputs
              inputs={inputs}
              onChange={(next) => {
                void saveWorkflowInputs(
                  client,
                  workflow.id,
                  trigger.id,
                  next
                ).then(report)
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">No trigger</Badge>
            </div>
          )}
        </section>
        <WorkflowSheetRuns workflowId={workflow.id} runs={runs} cards={cards} />
      </div>
      <WorkflowSheetStart
        cards={cards}
        cardId={cardId}
        pending={pending}
        onCard={setCardId}
        onStart={() => void onStart()}
      />
    </>
  )
}
