import { useState } from "react"
import { useParams } from "react-router"
import {
  useFlowsClient,
  useOptionalFlowsClient,
  useQuery,
} from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { mono } from "@/components/data/mono"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"
import { workflowLabel } from "@/lib/labels"
import { saveWorkflowYaml } from "./workflow-actions"

/** Remounts per workflow so each editor starts from its saved yaml. */
export function WorkflowEditorPage() {
  const { id = "" } = useParams()
  const existing = useOptionalFlowsClient()
  if (existing) return <Editor key={id} id={id} />
  return (
    <FlowsClientGate>
      <Editor key={id} id={id} />
    </FlowsClientGate>
  )
}

function Editor({ id }: { id: string }) {
  const client = useFlowsClient()
  const detailQ = useQuery("workflow/get", { id }, { topics: ["workflow"] })
  const [draft, setDraft] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const yaml = draft ?? detailQ.data?.yaml ?? ""
  const baseHash = hash ?? detailQ.data?.hash ?? ""
  const dirty =
    draft !== null && detailQ.data !== undefined && draft !== detailQ.data.yaml
  const title = detailQ.data
    ? workflowLabel({
        id,
        name: detailQ.data.workflow?.name,
      })
    : id

  async function save() {
    setPending(true)
    setConflict(false)
    setSaveError(null)
    const result = await saveWorkflowYaml(client, id, yaml, baseHash)
    setPending(false)
    if (typeof result === "object" && result.ok) {
      setDraft(yaml)
      setHash(result.hash)
      return
    }
    if (result === "conflict") setConflict(true)
    else setSaveError(result)
  }

  if (detailQ.loading && !detailQ.data) {
    return (
      <Page
        fill
        crumbs={[
          { label: "Workflows", to: "/workflows" },
          { label: id },
        ]}
        data-testid="mock-workflow-editor"
      >
        <PageTitle title={id} description="Loading workflow…" />
        <div className="space-y-3" data-testid="workflow-editor-loading">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-80 w-full" />
        </div>
      </Page>
    )
  }

  if (detailQ.error || !detailQ.data) {
    return (
      <Page
        fill
        crumbs={[
          { label: "Workflows", to: "/workflows" },
          { label: id },
        ]}
        data-testid="mock-workflow-editor"
      >
        <PageTitle title={id} description="Could not load workflow." />
        <Alert variant="destructive" data-testid="workflow-editor-error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {detailQ.error ? errorMessage(detailQ.error) : "Not found"}
          </AlertDescription>
        </Alert>
      </Page>
    )
  }

  return (
    <Page
      fill
      crumbs={[
        { label: "Workflows", to: "/workflows" },
        { label: title },
      ]}
      actions={
        <Button
          data-testid="workflow-editor-save"
          disabled={!dirty || pending}
          onClick={() => void save()}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      }
      data-testid="mock-workflow-editor"
    >
      <PageTitle
        title={title}
        description="Edit workflow.yaml. Save uses an optimistic lock (baseHash)."
      />
      {(conflict || saveError) && (
        <Alert variant="destructive" data-testid="workflow-editor-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "The file changed on disk. Reload or copy your edits, then try again."
              : saveError}
          </AlertDescription>
        </Alert>
      )}
      <Textarea
        value={yaml}
        onChange={(e) => setDraft(e.target.value)}
        className={`min-h-0 flex-1 text-sm ${mono}`}
        data-testid="workflow-editor-yaml"
      />
    </Page>
  )
}
