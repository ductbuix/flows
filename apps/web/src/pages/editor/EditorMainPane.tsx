import type { Workflow, YamlDiagnosticDto } from "@workspace/shared"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { EditorGraphPane } from "./EditorGraphPane"
import { YamlPane } from "./YamlPane"

export type EditorPane = "graph" | "yaml"

type Props = {
  pane: EditorPane
  onPaneChange: (pane: EditorPane) => void
  workflow: Workflow | null
  selectedTaskId: string | undefined
  onSelectTask: (id: string | undefined) => void
  onConnect: (source: string, target: string) => void
  yaml: string
  errors: YamlDiagnosticDto[]
  onChangeYaml: (value: string) => void
}

/** Graph / YAML tabs for the editor canvas (BL-037). */
export function EditorMainPane({
  pane,
  onPaneChange,
  workflow,
  selectedTaskId,
  onSelectTask,
  onConnect,
  yaml,
  errors,
  onChangeYaml,
}: Props) {
  return (
    <Tabs
      value={pane}
      onValueChange={(v) => {
        if (v === "graph" || v === "yaml") onPaneChange(v)
      }}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="shrink-0 px-4 pt-2">
        <TabsList variant="line" data-testid="editor-pane-tabs">
          <TabsTrigger value="graph" data-testid="editor-tab-graph">
            Graph
          </TabsTrigger>
          <TabsTrigger value="yaml" data-testid="editor-tab-yaml">
            YAML
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="graph"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <EditorGraphPane
          workflow={workflow}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onConnect={onConnect}
        />
      </TabsContent>
      <TabsContent
        value="yaml"
        className="mt-0 min-h-0 flex-1 overflow-hidden p-4"
      >
        <YamlPane value={yaml} errors={errors} onChange={onChangeYaml} />
      </TabsContent>
    </Tabs>
  )
}
