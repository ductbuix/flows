import { useState } from "react"
import { useParams } from "react-router"
import type { LayoutFile } from "@workspace/contracts"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { mono } from "@/components/data/mono"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"
import { workflowLabel } from "@/lib/labels"
import { WorkflowCanvas } from "./canvas/WorkflowCanvas"
import { saveWorkflowLayout, saveWorkflowYaml } from "./workflow-actions"

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
  const client = useFlowsClient()
  const detailQ = useQuery("workflow/get", { id }, { topics: ["workflow"] })
  const [draft, setDraft] = useState<string | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [layoutDraft, setLayoutDraft] = useState<LayoutFile | null>(null)
  const [layoutSaved, setLayoutSaved] = useState<LayoutFile | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const yaml = draft ?? detailQ.data?.yaml ?? ""
  const baseHash = hash ?? detailQ.data?.hash ?? ""
  const serverLayout = detailQ.data?.layout ?? EMPTY_LAYOUT
  const baselineLayout = layoutSaved ?? serverLayout
  const layout = layoutDraft ?? baselineLayout
  const yamlDirty =
    draft !== null && detailQ.data !== undefined && draft !== detailQ.data.yaml
  const layoutDirty =
    layoutDraft !== null &&
    JSON.stringify(layoutDraft) !== JSON.stringify(baselineLayout)
  const dirty = yamlDirty || layoutDirty
  const title = detailQ.data
    ? workflowLabel({
        id,
        name: detailQ.data.workflow?.name,
      })
    : id
  const parsed = detailQ.data?.workflow
  const canvasKey = `${id}:${detailQ.data?.hash ?? ""}`

  async function save() {
    setPending(true)
    setConflict(false)
    setSaveError(null)
    if (yamlDirty) {
      const result = await saveWorkflowYaml(client, id, yaml, baseHash)
      if (typeof result === "object" && result.ok) {
        setDraft(yaml)
        setHash(result.hash)
      } else if (result === "conflict") {
        setConflict(true)
        setPending(false)
        return
      } else {
        setSaveError(result)
        setPending(false)
        return
      }
    }
    if (layoutDirty && layoutDraft) {
      const result = await saveWorkflowLayout(client, id, layoutDraft)
      if (typeof result === "object" && result.ok) {
        setLayoutSaved(result.layout)
        setLayoutDraft(null)
      } else {
        setSaveError(result)
        setPending(false)
        return
      }
    }
    setPending(false)
  }

  if (detailQ.loading && !detailQ.data) {
    return (
      <Page
        fill
        crumbs={[{ label: "Workflows", to: "/workflows" }, { label: id }]}
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
        crumbs={[{ label: "Workflows", to: "/workflows" }, { label: id }]}
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
      crumbs={[{ label: "Workflows", to: "/workflows" }, { label: title }]}
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
        description="Edit the node canvas or YAML. Save writes workflow.yaml and layout."
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
      <Tabs defaultValue="canvas" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="canvas" data-testid="workflow-editor-tab-canvas">
            Canvas
          </TabsTrigger>
          <TabsTrigger value="yaml" data-testid="workflow-editor-tab-yaml">
            YAML
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="canvas"
          className="mt-3 flex min-h-0 flex-1 flex-col data-[hidden]:hidden"
        >
          {parsed ? (
            <WorkflowCanvas
              key={canvasKey}
              workflow={parsed}
              layout={layout}
              onLayoutChange={setLayoutDraft}
            />
          ) : (
            <Alert data-testid="workflow-canvas-invalid">
              <AlertTitle>Invalid workflow</AlertTitle>
              <AlertDescription>
                Fix the YAML tab so the canvas can render nodes.
                {detailQ.data.errors[0]
                  ? ` ${detailQ.data.errors[0]!.message}`
                  : ""}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        <TabsContent
          value="yaml"
          className="mt-3 flex min-h-0 flex-1 flex-col data-[hidden]:hidden"
        >
          <Textarea
            value={yaml}
            onChange={(e) => setDraft(e.target.value)}
            className={`min-h-0 flex-1 text-sm ${mono}`}
            data-testid="workflow-editor-yaml"
          />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
