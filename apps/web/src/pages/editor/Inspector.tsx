import type { Task, Workflow, YamlDiagnosticDto } from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { MemoryPanel } from "./MemoryPanel"
import { taskFieldErrors } from "./field-errors"

type Props = {
  workflowId: string
  workflow: Workflow
  selectedTaskId?: string
  errors: YamlDiagnosticDto[]
  onChangeGoal: (goal: string) => void
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
  onRenameTask: (fromId: string, toId: string) => void
}

export function Inspector({
  workflowId,
  workflow,
  selectedTaskId,
  errors,
  onChangeGoal,
  onChangeTask,
  onRenameTask,
}: Props) {
  const taskIndex = workflow.tasks.findIndex((t) => t.id === selectedTaskId)
  const task = taskIndex >= 0 ? workflow.tasks[taskIndex] : undefined

  if (!task) {
    return (
      <div className="space-y-3 overflow-auto p-3" data-testid="inspector">
        <h2 className="text-sm font-medium">Workflow</h2>
        <Field>
          <FieldLabel htmlFor="field-goal">Goal</FieldLabel>
          <Textarea
            id="field-goal"
            data-testid="field-goal"
            value={workflow.goal ?? ""}
            onChange={(e) => onChangeGoal(e.target.value)}
            rows={3}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Select a task to edit its fields.
        </p>
        <MemoryPanel workflowId={workflowId} />
      </div>
    )
  }

  const runErrors = taskFieldErrors(errors, taskIndex, "run")
  const cliErrors = taskFieldErrors(errors, taskIndex, "cli")
  const instructionsErrors = taskFieldErrors(errors, taskIndex, "instructions")

  return (
    <div className="space-y-3 overflow-auto p-3" data-testid="inspector">
      <h2 className="font-mono text-sm font-medium">{task.id}</h2>
      <Field>
        <FieldLabel htmlFor="field-id">Id</FieldLabel>
        <Input
          id="field-id"
          data-testid="field-id"
          defaultValue={task.id}
          key={task.id}
          onBlur={(e) => {
            const next = e.target.value.trim()
            if (next && next !== task.id) onRenameTask(task.id, next)
          }}
        />
      </Field>
      <Field>
        <FieldLabel>Kind</FieldLabel>
        <Select
          value={task.kind}
          onValueChange={(kind) => {
            if (kind === "command" || kind === "agent") {
              onChangeTask(task.id, { kind } as Partial<Task>)
            }
          }}
        >
          <SelectTrigger data-testid="field-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">command</SelectItem>
            <SelectItem value="agent">agent</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {task.kind === "command" ? (
        <Field data-invalid={runErrors.length > 0 || undefined}>
          <FieldLabel htmlFor="field-run">Run</FieldLabel>
          <Textarea
            id="field-run"
            data-testid="field-run"
            value={task.run}
            aria-invalid={runErrors.length > 0 || undefined}
            onChange={(e) => onChangeTask(task.id, { run: e.target.value })}
            rows={3}
          />
          <FieldError data-testid="field-error-run" errors={runErrors} />
        </Field>
      ) : (
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
          <Field data-invalid={instructionsErrors.length > 0 || undefined}>
            <FieldLabel htmlFor="field-instructions">Instructions</FieldLabel>
            <Input
              id="field-instructions"
              data-testid="field-instructions"
              value={task.instructions}
              aria-invalid={instructionsErrors.length > 0 || undefined}
              onChange={(e) =>
                onChangeTask(task.id, { instructions: e.target.value })
              }
            />
            <FieldError
              data-testid="field-error-instructions"
              errors={instructionsErrors}
            />
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
      )}
      <Field className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor="field-approval">Approval</FieldLabel>
        <Switch
          id="field-approval"
          data-testid="field-approval"
          checked={Boolean(task.approval)}
          onCheckedChange={(approval) => onChangeTask(task.id, { approval })}
        />
      </Field>
    </div>
  )
}
