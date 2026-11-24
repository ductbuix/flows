import { Trash2Icon } from "lucide-react"
import {
  proposeConnectionsUpstream,
  type AnswerDecl,
  type AssetResource,
  type Workflow,
  type WorkflowInputDecl,
  type WorkflowNode,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { AnswersEditor } from "./AnswersEditor"
import { AssetResources } from "./AssetResources"
import { MemoryCombobox } from "./MemoryCombobox"
import { TriggerInputs } from "./TriggerInputs"
import { kindLabel } from "./node-kind-ui"
import { parsePositiveInt, settingKeys } from "./node-sheet"

type Props = {
  workflowId: string
  /** The whole graph: a publish Output lists the connections upstream. */
  graph?: Workflow
  node: WorkflowNode
  onSetting: (key: string, value: unknown) => void
  onEditEnd: () => void
  onDelete: () => void
  onClose: () => void
}

/** The 384px node Sheet: settings that do not fit on the card (DES-036). */
export function NodeSheet({
  workflowId,
  graph,
  node,
  onSetting,
  onEditEnd,
  onDelete,
  onClose,
}: Props) {
  const keys = settingKeys(node.kind)
  const loose = node as WorkflowNode & {
    timeout?: number
    retry?: { max: number }
    memory?: string[]
    answers?: AnswerDecl[]
    inputs?: WorkflowInputDecl[]
    resources?: AssetResource[]
    access?: "read" | "propose"
    target?: "folder" | "publish" | "notify"
    connection?: string
    title?: string
  }
  const proposeOptions =
    node.kind === "output" && graph
      ? proposeConnectionsUpstream(graph.nodes, graph.edges, node.id)
      : []
  const number = (key: "timeout" | "retry", raw: string) => {
    const n = parsePositiveInt(raw)
    if (n === null) return
    onSetting(
      key,
      n === undefined ? undefined : key === "retry" ? { max: n } : n
    )
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        data-testid="node-sheet"
        finalFocus={() =>
          document.querySelector<HTMLElement>(
            `.react-flow__node[data-id="${CSS.escape(node.id)}"]`
          )
        }
      >
        <SheetHeader>
          <SheetTitle>{node.name ?? node.id}</SheetTitle>
          <SheetDescription>{kindLabel(node.kind)} node</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="node-name">Name</FieldLabel>
              <Input
                id="node-name"
                data-testid="node-name"
                placeholder={node.id}
                value={node.name ?? ""}
                onChange={(e) =>
                  onSetting(
                    "name",
                    e.target.value.trim() ? e.target.value : undefined
                  )
                }
                onBlur={onEditEnd}
              />
            </Field>
            {keys.has("timeout") ? (
              <Field>
                <FieldLabel htmlFor="node-timeout">
                  Timeout (seconds)
                </FieldLabel>
                <Input
                  id="node-timeout"
                  data-testid="node-timeout"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Workflow default"
                  value={loose.timeout ?? ""}
                  onChange={(e) => number("timeout", e.target.value)}
                  onBlur={onEditEnd}
                />
                <FieldDescription>
                  Per attempt. Empty uses the default.
                </FieldDescription>
              </Field>
            ) : null}
            {keys.has("retry") ? (
              <Field>
                <FieldLabel htmlFor="node-retry">Retry attempts</FieldLabel>
                <Input
                  id="node-retry"
                  data-testid="node-retry"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="No retry"
                  value={loose.retry?.max ?? ""}
                  onChange={(e) => number("retry", e.target.value)}
                  onBlur={onEditEnd}
                />
              </Field>
            ) : null}
            {keys.has("access") ? (
              <Field>
                <FieldLabel>Access</FieldLabel>
                <Select
                  value={loose.access ?? "read"}
                  onValueChange={(v) => {
                    if (v) {
                      onSetting("access", v)
                      onEditEnd()
                    }
                  }}
                >
                  <SelectTrigger data-testid="asset-access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="propose">Propose</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Propose gives wired steps a work copy; an Output can publish
                  it.
                </FieldDescription>
              </Field>
            ) : null}
            {keys.has("target") ? (
              <Field>
                <FieldLabel>Target</FieldLabel>
                <Select
                  value={loose.target ?? "folder"}
                  onValueChange={(v) => {
                    if (v !== "folder" && v !== "publish" && v !== "notify")
                      return
                    onSetting("target", v)
                    if (v !== "notify") onSetting("title", undefined)
                    onSetting(
                      "connection",
                      v === "publish"
                        ? (proposeOptions[0] ?? undefined)
                        : undefined
                    )
                    onEditEnd()
                  }}
                >
                  <SelectTrigger data-testid="output-target-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="folder">Folder</SelectItem>
                    <SelectItem value="publish">Publish</SelectItem>
                    <SelectItem value="notify">Notify</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {loose.target === "notify" ? (
              <Field>
                <FieldLabel htmlFor="output-title">Notice title</FieldLabel>
                <Input
                  id="output-title"
                  data-testid="output-title"
                  placeholder={node.name ?? "Workflow name"}
                  value={loose.title ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    onSetting(
                      "title",
                      e.target.value.trim() ? e.target.value : undefined
                    )
                  }
                  onBlur={onEditEnd}
                />
                <FieldDescription>
                  Posts this title and the input text to the bell in the
                  sidebar.
                </FieldDescription>
              </Field>
            ) : null}
            {loose.target === "publish" ? (
              <Field>
                <FieldLabel>Connection</FieldLabel>
                <Select
                  value={loose.connection ?? ""}
                  onValueChange={(v) => {
                    if (v) {
                      onSetting("connection", v)
                      onEditEnd()
                    }
                  }}
                >
                  <SelectTrigger data-testid="output-connection-select">
                    <SelectValue placeholder="Pick a connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {proposeOptions.length === 0 ? (
                      <SelectItem value={loose.connection ?? "none"} disabled>
                        No propose Asset upstream
                      </SelectItem>
                    ) : (
                      proposeOptions.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Only connections of an upstream Asset with propose access. The
                  connection&apos;s policy decides who approves.
                </FieldDescription>
              </Field>
            ) : null}
            {keys.has("memory") ? (
              <Field>
                <FieldLabel>Memory files</FieldLabel>
                <MemoryCombobox
                  workflowId={workflowId}
                  value={loose.memory ?? []}
                  onChange={(v) => {
                    onSetting("memory", v)
                    onEditEnd()
                  }}
                />
              </Field>
            ) : null}
          </FieldGroup>
          {keys.has("answers") ? (
            <>
              <Separator />
              <AnswersEditor
                answers={loose.answers ?? []}
                onChange={(v) => {
                  onSetting("answers", v)
                  onEditEnd()
                }}
              />
            </>
          ) : null}
          {keys.has("resources") ? (
            <>
              <Separator />
              <AssetResources
                resources={loose.resources ?? []}
                onChange={(v) => {
                  onSetting("resources", v)
                  onEditEnd()
                }}
              />
            </>
          ) : null}
          {keys.has("inputs") ? (
            <>
              <Separator />
              <TriggerInputs
                inputs={loose.inputs ?? []}
                onChange={(v) => {
                  onSetting("inputs", v)
                  onEditEnd()
                }}
              />
            </>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            type="button"
            variant="destructive"
            data-testid="node-delete"
            onClick={onDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete node
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
