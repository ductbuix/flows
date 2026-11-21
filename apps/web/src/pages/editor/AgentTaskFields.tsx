import type { Task, YamlDiagnosticDto } from "@workspace/shared"
import { Switch } from "@workspace/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { taskFieldErrors } from "./field-errors"

type AgentTask = Extract<Task, { kind: "agent" }>

type Props = {
  task: AgentTask
  taskIndex: number
  errors: YamlDiagnosticDto[]
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
}

export function AgentTaskFields({
  task,
  taskIndex,
  errors,
  onChangeTask,
}: Props) {
  const cliErrors = taskFieldErrors(errors, taskIndex, "cli")

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
      <Field className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor="field-spawn">Spawn</FieldLabel>
        <Switch
          id="field-spawn"
          data-testid="field-spawn"
          checked={Boolean(task.spawn)}
          onCheckedChange={(spawn) => onChangeTask(task.id, { spawn })}
        />
      </Field>
    </>
  )
}
