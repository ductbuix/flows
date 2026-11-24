import { useState } from "react"
import { Play } from "lucide-react"
import type { DocketRef } from "@workspace/contracts"
import { useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { StatusPill } from "@/components/brand/StatusPill"
import { RelativeTime } from "@/components/data/RelativeTime"
import { RunSheet } from "@/components/runs/RunSheet"
import { statusOf } from "@/components/runs/status"
import { EmptyLine, Section } from "./SectionParts"
import { RunWorkflowDialog } from "./RunWorkflowDialog"

type Props = {
  cardId: string
  title: string
  refs: DocketRef[]
  assetNames: string[]
}

/** Runs of any workflow for this card; a row opens the run sheet. */
export function CardRunsSection({ cardId, title, refs, assetNames }: Props) {
  const listQ = useQuery(
    "run/list",
    { workItemId: cardId, limit: 100 },
    { topics: ["run"] }
  )
  const workflowsQ = useQuery("workflow/list", {}, { topics: ["workflow"] })
  const [running, setRunning] = useState(false)
  const [pickId, setPickId] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const runs = listQ.data?.items ?? []
  const workflows = workflowsQ.data?.items ?? []

  function clearErrors() {
    setConflict(false)
    setActionError(null)
  }

  return (
    <Section title="Runs">
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="card-runs-error">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This run changed elsewhere. Close the sheet and try again."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      {runs.length === 0 ? (
        <EmptyLine>No runs yet</EmptyLine>
      ) : (
        <div className="flex flex-col gap-0.5" data-testid="card-runs-list">
          {runs.map((r) => {
            const st = statusOf(r.status, r.needsYou.length > 0)
            return (
              <button
                key={r.id}
                type="button"
                className="-mx-2 flex min-h-8 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                data-testid={`card-run-row-${r.id}`}
                onClick={() => {
                  clearErrors()
                  setPickId(r.id)
                }}
              >
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
                <span className="min-w-0 flex-1 truncate">
                  {r.workflowName || r.workflowId}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.taskCounts.done}/{r.taskCounts.total} ·{" "}
                  <RelativeTime value={r.startedAt} />
                </span>
              </button>
            )
          })}
        </div>
      )}
      <Button
        variant="ghost"
        className="-mx-2 w-fit justify-start px-2 text-muted-foreground"
        onClick={() => {
          clearErrors()
          setRunning(true)
        }}
        data-testid="card-run-open"
      >
        <Play />
        Run workflow
      </Button>
      <RunWorkflowDialog
        card={{ id: cardId, title, refs, assetNames }}
        open={running}
        workflows={workflows}
        onOpenChange={setRunning}
        onStarted={(runId) => {
          clearErrors()
          setPickId(runId)
        }}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
      <RunSheet
        runId={pickId}
        onClose={() => setPickId(null)}
        onReran={(runId) => {
          clearErrors()
          setPickId(runId)
        }}
        onDeleted={clearErrors}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
    </Section>
  )
}
