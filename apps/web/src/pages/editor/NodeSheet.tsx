import { Trash2Icon } from "lucide-react"
import type { WorkflowInputDecl, WorkflowNode } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { MemoryCombobox } from "./MemoryCombobox"
import { TriggerInputs } from "./TriggerInputs"
import { kindLabel } from "./node-kind-ui"
import { parsePositiveInt, settingKeys } from "./node-sheet"

type Props = {
  workflowId: string
  node: WorkflowNode
  onSetting: (key: string, value: unknown) => void
  onEditEnd: () => void
  onDelete: () => void
  onClose: () => void
}

/** The 384px node Sheet: settings that do not fit on the card (DES-036). */
export function NodeSheet({
  workflowId,
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
    inputs?: WorkflowInputDecl[]
  }
  const number = (key: "timeout" | "retry", raw: string) => {
    const n = parsePositiveInt(raw)
    if (n === null) return
    onSetting(key, n === undefined ? undefined : key === "retry" ? { max: n } : n)
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
                  onSetting("name", e.target.value.trim() ? e.target.value : undefined)
                }
                onBlur={onEditEnd}
              />
            </Field>
            {keys.has("timeout") ? (
              <Field>
                <FieldLabel htmlFor="node-timeout">Timeout (seconds)</FieldLabel>
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
                <FieldDescription>Per attempt. Empty uses the default.</FieldDescription>
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
