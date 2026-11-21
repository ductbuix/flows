import type { AttemptView, RunDetail, TaskView } from "@workspace/shared"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Terminal } from "@/components/ai-elements/terminal"
import { taskCommandLine } from "./task-advanced"
import { useTaskLog } from "./useTaskLog"

type Props = {
  run: RunDetail
  task: TaskView
  attempt: AttemptView | undefined
  attemptN: number
}

function terminalStatus(
  task: TaskView,
  attempt: AttemptView | undefined
): "running" | "error" | undefined {
  if (task.status === "running") return "running"
  if (attempt?.exitCode !== undefined && attempt.exitCode !== 0) {
    return "error"
  }
  if (attempt?.reason) return "error"
  return undefined
}

function terminalTitle(
  command: string | undefined,
  status: "running" | "error" | undefined,
  exitCode: number | undefined
): string {
  const cmd = command ?? "command"
  if (status === "running") return `Running ${cmd}`
  if (status === "error") {
    return exitCode !== undefined
      ? `${cmd} exited with code ${exitCode}`
      : `Failed to run ${cmd}`
  }
  return `Ran ${cmd}`
}

/** Styled stdout Terminal for the selected attempt. */
export function TaskDetailTerminal({ run, task, attempt, attemptN }: Props) {
  const { text: logText, loading: logLoading } = useTaskLog(
    run.id,
    task.id,
    attemptN,
    "stdout"
  )
  const command = taskCommandLine(run, task.id)
  const status = terminalStatus(task, attempt)
  const title = terminalTitle(command, status, attempt?.exitCode)

  if (logLoading && !logText) {
    return <p className="text-sm text-muted-foreground">Loading log…</p>
  }

  if (!logText) {
    return (
      <Empty data-testid="task-terminal-empty">
        <EmptyTitle>No log output</EmptyTitle>
        <EmptyDescription>Nothing written to this stream yet.</EmptyDescription>
        <EmptyContent />
      </Empty>
    )
  }

  return (
    <Terminal
      title={title}
      output={logText}
      status={status}
      defaultOpen
      data-testid="task-terminal"
    />
  )
}
