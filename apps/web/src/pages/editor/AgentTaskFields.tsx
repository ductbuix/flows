import { useEffect, useState } from "react"
import {
  taskPromptPath,
  type Effort,
  type Task,
  type YamlDiagnosticDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useCliModels } from "@/hooks/use-cli-models"
import { PromptEditorDialog } from "./PromptEditorDialog"
import { taskFieldErrors } from "./field-errors"
import { api } from "@/lib/api"

type AgentTask = Extract<Task, { kind: "agent" }>

type Props = {
  workflowId: string
  task: AgentTask
  taskIndex: number
  errors: YamlDiagnosticDto[]
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
}

export function AgentTaskFields({
  workflowId,
  task,
  taskIndex,
  errors,
  onChangeTask,
}: Props) {
  const cliErrors = taskFieldErrors(errors, taskIndex, "cli")
  const promptPath = taskPromptPath(task.id)
  const [promptOpen, setPromptOpen] = useState(false)
  const [promptExists, setPromptExists] = useState<boolean | null>(null)
  const { catalog } = useCliModels(task.cli)

  useEffect(() => {
    let alive = true
    setPromptExists(null)
    void (async () => {
      const res = await api.workflows[":workflowId"].files[":path"].$get({
        param: { workflowId, path: promptPath },
      })
      if (!alive) return
      setPromptExists(res.ok)
    })()
    return () => {
      alive = false
    }
  }, [workflowId, promptPath])

  return (
    <>
      <Field data-invalid={cliErrors.length > 0 || undefined}>
        <FieldLabel>CLI</FieldLabel>
        <Select
          value={task.cli}
          onValueChange={(cli) => {
            if (cli === "claude" || cli === "cursor") {
              onChangeTask(task.id, { cli })
            }
          }}
        >
          <SelectTrigger
            data-testid="field-cli"
            aria-invalid={cliErrors.length > 0 || undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude">claude</SelectItem>
            <SelectItem value="cursor">cursor</SelectItem>
          </SelectContent>
        </Select>
        <FieldError data-testid="field-error-cli" errors={cliErrors} />
      </Field>
      <Field>
        <FieldLabel>Model and effort</FieldLabel>
        <ModelSelector
          catalog={catalog}
          model={task.model}
          effort={task.effort}
          onChangeModel={(model) => onChangeTask(task.id, { model })}
          onChangeEffort={(effort: Effort | undefined) =>
            onChangeTask(task.id, { effort })
          }
        />
        <FieldDescription>
          Empty means the CLI settings apply. Changing CLI keeps the current
          values.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Prompt</FieldLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          data-testid="edit-prompt"
          onClick={() => setPromptOpen(true)}
        >
          Edit prompt
        </Button>
        <FieldDescription data-testid="field-prompt-path">
          Stored at <span className="font-mono">{promptPath}</span> in this
          workflow.
          {promptExists === false ? " Not created yet." : null}
        </FieldDescription>
      </Field>
      <Field className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor="field-spawn">Spawn</FieldLabel>
        <Switch
          id="field-spawn"
          data-testid="field-spawn"
          checked={Boolean(task.spawn)}
          onCheckedChange={(spawn) => onChangeTask(task.id, { spawn })}
        />
      </Field>
      <PromptEditorDialog
        workflowId={workflowId}
        path={promptPath}
        open={promptOpen}
        onOpenChange={setPromptOpen}
        onSaved={() => setPromptExists(true)}
      />
    </>
  )
}
