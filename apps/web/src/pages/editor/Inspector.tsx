import type {
  Task,
  Workflow,
  WorkflowInputDecl,
  WorkflowLimits,
  YamlDiagnosticDto,
} from "@workspace/shared"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { ActionButton } from "@/components/ActionButton"
import { AgentTaskFields } from "./AgentTaskFields"
import { InputsPanel } from "./InputsPanel"
import { MemoryPanel } from "./MemoryPanel"
import { taskFieldErrors } from "./field-errors"

type Props = {
  workflowId: string
  workflow: Workflow
  selectedTaskId?: string
  errors: YamlDiagnosticDto[]
  onChangeGoal: (goal: string) => void
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
  onChangeInputs: (inputs: WorkflowInputDecl[] | undefined) => void
  onChangeLimits: (limits: WorkflowLimits | undefined) => void
  onDeleteTask: (taskId: string) => void
}

export function Inspector({
  workflowId,
  workflow,
  selectedTaskId,
  errors,
  onChangeGoal,
  onChangeTask,
  onChangeInputs,
  onChangeLimits,
  onDeleteTask,
}: Props) {
  const taskIndex = workflow.tasks.findIndex((t) => t.id === selectedTaskId)
  const task = taskIndex >= 0 ? workflow.tasks[taskIndex] : undefined

  if (!task) {
    return (
      <div className="overflow-auto p-4" data-testid="inspector">
        <FieldGroup>
          <FieldSet>
            <FieldLegend variant="label">Workflow</FieldLegend>
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
          </FieldSet>
          <InputsPanel
            inputs={workflow.inputs}
            limits={workflow.limits}
            onChangeInputs={onChangeInputs}
            onChangeLimits={onChangeLimits}
          />
          <FieldDescription>Select a task to edit its fields.</FieldDescription>
          <MemoryPanel workflowId={workflowId} />
        </FieldGroup>
      </div>
    )
  }

  const runErrors = taskFieldErrors(errors, taskIndex, "run")

  return (
    <div className="overflow-auto p-4" data-testid="inspector">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="field-task-name">Name</FieldLabel>
          <Input
            id="field-task-name"
            data-testid="field-task-name"
            value={task.name ?? ""}
            onChange={(e) => {
              const next = e.target.value
              onChangeTask(task.id, {
                name: next === "" ? undefined : next,
              })
            }}
          />
        </Field>
        <Field>
          <FieldLabel>Id</FieldLabel>
          <p
            className="font-mono text-sm text-muted-foreground select-all"
            data-testid="field-task-id"
          >
            {task.id}
          </p>
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
          <AgentTaskFields
            workflowId={workflowId}
            task={task}
            taskIndex={taskIndex}
            errors={errors}
            onChangeTask={onChangeTask}
          />
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
        <Separator />
        <ActionButton
          type="button"
          variant="destructive"
          size="sm"
          data-testid="delete-task"
          disabled={workflow.tasks.length <= 1}
          disabledReason="A workflow needs at least one task"
          onClick={() => onDeleteTask(task.id)}
        >
          Delete task
        </ActionButton>
      </FieldGroup>
    </div>
  )
}
