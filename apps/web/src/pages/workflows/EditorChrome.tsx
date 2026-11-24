import type { LayoutFile, Workflow } from "@workspace/contracts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { mono } from "@/components/data/mono"
import { Page, PageTitle } from "@/components/page"
import { WorkflowCanvas } from "./canvas/WorkflowCanvas"

type History = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

type Props = {
  id: string
  title: string
  yaml: string
  layout: LayoutFile
  parsed: Workflow | null
  parseError?: string
  canvasKey: string
  dirty: boolean
  pending: boolean
  history: History
  alertKind: "validation" | "conflict" | "error" | null
  alertBody: string
  onYamlChange: (yaml: string) => void
  onLayoutChange: (layout: LayoutFile) => void
  onSave: () => void
}

/** Loaded editor chrome: alerts, tabs, canvas and YAML. */
export function EditorChrome({
  id,
  title,
  yaml,
  layout,
  parsed,
  parseError,
  canvasKey,
  dirty,
  pending,
  history,
  alertKind,
  alertBody,
  onYamlChange,
  onLayoutChange,
  onSave,
}: Props) {
  return (
    <Page
      fill
      crumbs={[{ label: "Workflows", to: "/workflows" }, { label: title }]}
      actions={
        <Button
          data-testid="workflow-editor-save"
          disabled={!dirty || pending}
          onClick={onSave}
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
      {alertKind ? (
        <Alert
          variant="destructive"
          data-testid={
            alertKind === "validation"
              ? "workflow-editor-validation"
              : "workflow-editor-conflict"
          }
        >
          <AlertTitle>
            {alertKind === "validation"
              ? "Invalid workflow"
              : alertKind === "conflict"
                ? "Conflict"
                : "Could not save"}
          </AlertTitle>
          <AlertDescription>{alertBody}</AlertDescription>
        </Alert>
      ) : null}
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
              workflowId={id}
              workflow={parsed}
              yaml={yaml}
              layout={layout}
              onYamlChange={onYamlChange}
              onLayoutChange={onLayoutChange}
              history={history}
            />
          ) : (
            <Alert data-testid="workflow-canvas-invalid">
              <AlertTitle>Invalid workflow</AlertTitle>
              <AlertDescription>
                Fix the YAML tab so the canvas can render nodes.
                {parseError ? ` ${parseError}` : ""}
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
            onChange={(e) => onYamlChange(e.target.value)}
            className={`min-h-0 flex-1 text-sm ${mono}`}
            data-testid="workflow-editor-yaml"
          />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
