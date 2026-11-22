import type {
  Task,
  Workflow,
  WorkflowAgent,
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { ActionButton } from "@/components/ActionButton"
import { AgentTaskFields } from "./AgentTaskFields"
import { ConnectionsFieldSet } from "./ConnectionsFieldSet"
import { InspectorWorkflowPanel } from "./InspectorWorkflowPanel"
import { LoneAgentJudges } from "./LoneAgentJudges"
import { PublishTaskFields } from "./PublishTaskFields"
import { taskFieldErrors } from "./field-errors"
import { mono } from "@/components/data/mono"

type Props = {
  workflowId: string
  workflow: Workflow
  selectedTaskId?: string
  errors: YamlDiagnosticDto[]
  onChangeName: (name: string) => void
  onChangeGoal: (goal: string) => void
  onChangeTask: (taskId: string, patch: Partial<Task>) => void
  onChangeInputs: (inputs: WorkflowInputDecl[] | undefined) => void
  onChangeLimits: (limits: WorkflowLimits | undefined) => void
  onChangeAgent: (agent: WorkflowAgent | undefined) => void
  onDeleteTask: (taskId: string) => void
}

export function Inspector({
  workflowId,
  workflow,
  selectedTaskId,
  errors,
  onChangeName,
  onChangeGoal,
  onChangeTask,
  onChangeInputs,
  onChangeLimits,
  onChangeAgent,
  onDeleteTask,
}: Props) {
  const taskIndex = workflow.tasks.findIndex((t) => t.id === selectedTaskId)
  const task = taskIndex >= 0 ? workflow.tasks[taskIndex] : undefined

  if (!task) {
    return (
      <InspectorWorkflowPanel
        workflowId={workflowId}
        workflow={workflow}
        onChangeName={onChangeName}
        onChangeGoal={onChangeGoal}
        onChangeInputs={onChangeInputs}
        onChangeLimits={onChangeLimits}
        onChangeAgent={onChangeAgent}
      />
    )
  }

  const runErrors = taskFieldErrors(errors, taskIndex, "run")
  const isPublish = task.kind === "publish"

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
            className={`${mono} text-sm text-muted-foreground select-all`}
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
              if (
                kind === "command" ||
                kind === "agent" ||
                kind === "publish"
              ) {
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
              <SelectItem value="publish">publish</SelectItem>
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
        ) : null}
        {task.kind === "agent" ? (
          <AgentTaskFields
            workflowId={workflowId}
            task={task}
            taskIndex={taskIndex}
            errors={errors}
            onChangeTask={onChangeTask}
          />
        ) : null}
        {isPublish ? (
          <PublishTaskFields
            task={task}
            workflow={workflow}
            onChangeTask={onChangeTask}
          />
        ) : null}
        {!isPublish ? (
          <Field className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="field-approval">Approval</FieldLabel>
            <Switch
              id="field-approval"
              data-testid="field-approval"
              checked={Boolean(task.approval)}
              onCheckedChange={(approval) =>
                onChangeTask(task.id, { approval })
              }
            />
          </Field>
        ) : null}
        {!isPublish ? (
          <LoneAgentJudges task={task} onChangeTask={onChangeTask} />
        ) : null}
        {!isPublish ? (
          <ConnectionsFieldSet task={task} onChangeTask={onChangeTask} />
        ) : null}
        <Separator />
        <ActionButton
          type="button"
          variant="destructive"
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
