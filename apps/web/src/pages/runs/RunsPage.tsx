import { useState } from "react"
import { Play } from "lucide-react"
import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { RunSheet } from "./RunSheet"
import { RunStartDialog } from "./RunStartDialog"
import { RunsList } from "./RunsList"
import { RunsEmpty, RunsLoadError, RunsLoading } from "./RunsStates"

export function RunsPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <RunsPageInner />
  return (
    <FlowsClientGate>
      <RunsPageInner />
    </FlowsClientGate>
  )
}

function RunsPageInner() {
  const listQ = useQuery("run/list", { limit: 100 }, { topics: ["run"] })
  const workflowsQ = useQuery("workflow/list", {}, { topics: ["workflow"] })
  const [pickId, setPickId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const runs = listQ.data?.items ?? []
  const workflows = workflowsQ.data?.items ?? []
  const loading =
    (listQ.loading && !listQ.data) || (workflowsQ.loading && !workflowsQ.data)

  function clearErrors() {
    setConflict(false)
    setActionError(null)
  }

  if (loading) return <RunsLoading />
  if (listQ.error && !listQ.data) return <RunsLoadError error={listQ.error} />

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Runs" }]}
      actions={
        <Button
          onClick={() => {
            clearErrors()
            setStarting(true)
          }}
          data-testid="runs-start-open"
        >
          <Play />
          Start run
        </Button>
      }
      data-testid="mock-runs-page"
    >
      <PageTitle
        title="Runs"
        description="Live and finished runs across workflows. Open one to cancel, run again or delete."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="runs-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This run changed elsewhere. Close the sheet and try again."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      {runs.length === 0 ? (
        <RunsEmpty />
      ) : (
        <RunsList
          runs={runs}
          onPick={(id) => {
            clearErrors()
            setPickId(id)
          }}
        />
      )}
      <RunStartDialog
        open={starting}
        workflows={workflows}
        onOpenChange={setStarting}
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
    </Page>
  )
}
