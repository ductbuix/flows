import type { AttemptView, RunDetail, TaskView } from "@workspace/shared"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Plan } from "@workspace/ui/components/plan"
import { StackTrace } from "@workspace/ui/components/stack-trace"
import { Task } from "@workspace/ui/components/task"
import { AttemptKindBadge } from "./AttemptKindBadge"

type Props = {
  run: RunDetail
  task: TaskView
}

function attemptStepStatus(
  task: TaskView,
  a: AttemptView
): "running" | "error" | undefined {
  const last = task.attempts.at(-1)
  if (task.status === "running" && a.attempt === last?.attempt) {
    return "running"
  }
  if (a.reason || (a.exitCode !== undefined && a.exitCode !== 0)) {
    return "error"
  }
  return undefined
}

function attemptTitle(a: AttemptView): string {
  const bits = [`Attempt ${a.attempt}`, a.kind.label]
  if (a.exitCode !== undefined) bits.push(`exit ${a.exitCode}`)
  if (a.reason) bits.push(a.reason)
  return bits.join(" · ")
}

export function TaskDetailAttempts({ run, task }: Props) {
  const node = run.graph.nodes.find((n) => n.id === task.id)
  const retryMax = node && "retry" in node ? node.retry?.max : undefined
  const failed = task.attempts.filter(
    (a) => a.reason || (a.exitCode !== undefined && a.exitCode !== 0)
  )

  if (task.attempts.length === 0) {
    return (
      <Empty>
        <EmptyTitle>Not started</EmptyTitle>
        <EmptyDescription>This task has no attempts yet.</EmptyDescription>
        <EmptyContent />
      </Empty>
    )
  }

  const taskStatus =
    task.status === "running"
      ? ("running" as const)
      : task.status === "failed"
        ? ("error" as const)
        : undefined

  const planSteps =
    retryMax !== undefined
      ? Array.from({ length: retryMax }, (_, i) => {
          const n = i + 1
          const a = task.attempts.find((x) => x.attempt === n)
          if (!a) {
            return {
              title: `Attempt ${n}`,
              status: "pending" as const,
            }
          }
          const running =
            task.status === "running" &&
            a.attempt === task.attempts.at(-1)?.attempt
          if (running) {
            return { title: attemptTitle(a), status: "running" as const }
          }
          if (a.reason || (a.exitCode !== undefined && a.exitCode !== 0)) {
            return { title: attemptTitle(a), status: "done" as const }
          }
          return { title: attemptTitle(a), status: "done" as const }
        })
      : null

  return (
    <div className="flex flex-col gap-4">
      {planSteps ? (
        <Plan
          title={`Plan: ${task.id} retries`}
          steps={planSteps}
          data-testid="attempts-plan"
        />
      ) : null}

      <Task
        title={
          taskStatus === "running"
            ? `Running ${task.id}`
            : taskStatus === "error"
              ? `Failed ${task.id}`
              : `Finished ${task.id}`
        }
        status={taskStatus}
        defaultOpen
        data-testid="attempts-task"
        steps={task.attempts.map((a) => ({
          title: attemptTitle(a),
          status: attemptStepStatus(task, a),
          "data-testid": `attempt-row-${a.attempt}`,
        }))}
      />

      <div className="flex flex-col gap-2">
        {task.attempts.map((a) => (
          <div
            key={a.attempt}
            className="flex flex-wrap items-center gap-2"
            data-testid={`attempt-meta-${a.attempt}`}
          >
            <AttemptKindBadge kind={a.kind} attempt={a.attempt} />
            <span
              className="text-sm text-muted-foreground"
              data-testid={`attempt-reason-${a.attempt}`}
            >
              {a.reason ??
                (a.exitCode !== undefined ? `exit ${a.exitCode}` : "—")}
            </span>
            {a.pid !== undefined ? (
              <span className="text-sm text-muted-foreground">pid {a.pid}</span>
            ) : null}
            {a.model !== undefined ||
            a.effort !== undefined ||
            a.modelSource !== undefined ? (
              <span
                className="text-sm text-muted-foreground"
                data-testid={`attempt-model-${a.attempt}`}
              >
                {[
                  a.model,
                  a.effort,
                  a.modelSource ? `via ${a.modelSource}` : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {failed.map((a) => (
        <StackTrace
          key={`stack-${a.attempt}`}
          error={a.reason ?? `exit code ${a.exitCode}`}
          frames={
            a.reason
              ? [`attempt ${a.attempt}`, a.kind.label]
              : [`attempt ${a.attempt}`, `exit ${a.exitCode}`]
          }
          data-testid={`attempt-stack-${a.attempt}`}
        />
      ))}
    </div>
  )
}
