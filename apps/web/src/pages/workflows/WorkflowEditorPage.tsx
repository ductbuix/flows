import { useCallback, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import {
  parseNodeWorkflowYaml,
  type LayoutFile,
  type WorkflowDetail,
} from "@workspace/contracts"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"
import { workflowLabel } from "@/lib/labels"
import {
  useEditorHistory,
  type EditorSnapshot,
} from "./canvas/use-editor-history"
import { EditorChrome } from "./EditorChrome"
import { saveEditor } from "./editor-save"

const EMPTY_LAYOUT: LayoutFile = { version: 1, nodes: {} }

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
  const detailQ = useQuery("workflow/get", { id }, { topics: ["workflow"] })

  if (detailQ.loading && !detailQ.data) {
    return (
      <Page
        fill
        crumbs={[{ label: "Workflows", to: "/workflows" }, { label: id }]}
        data-testid="workflow-editor"
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
        crumbs={[{ label: "Workflows", to: "/workflows" }, { label: id }]}
        data-testid="workflow-editor"
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

  return <EditorReady id={id} detail={detailQ.data} />
}

function EditorReady({ id, detail }: { id: string; detail: WorkflowDetail }) {
  const client = useFlowsClient()
  const [params, setParams] = useSearchParams()
  const runView = params.get("run") ?? "draft"
  const [draft, setDraft] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<LayoutFile | null>(null)
  const [layoutSaved, setLayoutSaved] = useState<LayoutFile | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [pending, setPending] = useState(false)

  function setRunView(next: string) {
    const p = new URLSearchParams(params)
    if (next === "draft") p.delete("run")
    else p.set("run", next)
    setParams(p, { replace: true })
  }

  const yaml = draft ?? detail.yaml
  const baseHash = hash ?? detail.hash
  const baselineLayout = layoutSaved ?? detail.layout ?? EMPTY_LAYOUT
  const layout = layoutDraft ?? baselineLayout
  const yamlDirty = draft !== null && draft !== detail.yaml
  const layoutDirty =
    layoutDraft !== null &&
    JSON.stringify(layoutDraft) !== JSON.stringify(baselineLayout)
  const title = workflowLabel({ id, name: detail.workflow?.name })
  const localParsed = useMemo(() => parseNodeWorkflowYaml(yaml), [yaml])
  const applySnapshot = useCallback((s: EditorSnapshot) => {
    setDraft(s.yaml)
    setLayoutDraft(s.layout)
  }, [])
  // Mounted only after detail loads; seed is the saved file.
  const history = useEditorHistory(yaml, layout, applySnapshot, true)

  async function save() {
    setPending(true)
    setConflict(false)
    setSaveError(null)
    setValidationErrors([])
    const result = await saveEditor({
      client,
      id,
      yaml,
      baseHash,
      yamlDirty,
      layoutDirty,
      layoutDraft,
    })
    setPending(false)
    if (result.kind === "validation") {
      setValidationErrors(result.messages)
      return
    }
    if (result.kind === "conflict") {
      setConflict(true)
      return
    }
    if (result.kind === "error") {
      setSaveError(result.message)
      return
    }
    if (result.hash) {
      setDraft(yaml)
      setHash(result.hash)
    }
    if (result.layout) {
      setLayoutSaved(result.layout)
      setLayoutDraft(null)
    }
  }

  const alertKind =
    validationErrors.length > 0
      ? ("validation" as const)
      : conflict
        ? ("conflict" as const)
        : saveError
          ? ("error" as const)
          : null

  return (
    <EditorChrome
      id={id}
      title={title}
      yaml={yaml}
      layout={layout}
      parsed={localParsed.workflow}
      parseError={localParsed.errors[0]?.message}
      canvasKey={`${id}:${detail.hash}`}
      dirty={yamlDirty || layoutDirty}
      pending={pending}
      history={history}
      alertKind={alertKind}
      alertBody={
        alertKind === "validation"
          ? validationErrors.join(" · ")
          : alertKind === "conflict"
            ? "The file changed on disk. Reload or copy your edits, then try again."
            : (saveError ?? "")
      }
      runView={runView}
      onRunView={setRunView}
      onYamlChange={setDraft}
      onLayoutChange={setLayoutDraft}
      onSave={() => void save()}
    />
  )
}
