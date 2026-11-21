import { useState } from "react"
import type { AttemptView, RunDetail, TaskView } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import {
  CodeBlock,
  CodeBlockContent,
} from "@workspace/ui/components/code-block"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Item, ItemContent, ItemTitle } from "@workspace/ui/components/item"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { EnvironmentVariables } from "@/components/ai-elements/environment-variables"
import { Terminal } from "@/components/ai-elements/terminal"
import { useAdvanced } from "@/hooks/use-advanced"
import { taskCommandLine, taskEnvVars } from "./task-advanced"
import { useTaskLog, type LogStream } from "./useTaskLog"

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

export function TaskDetailLogs({ run, task, attempt, attemptN }: Props) {
  const { advanced } = useAdvanced()
  const [logStream, setLogStream] = useState<LogStream>("stdout")
  const { text: logText, loading: logLoading } = useTaskLog(
    run.id,
    task.id,
    attemptN,
    advanced ? logStream : "stdout"
  )
  const command = taskCommandLine(run, task.id)
  const status = terminalStatus(task, attempt)
  const title = terminalTitle(command, status, attempt?.exitCode)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {logLoading && !logText ? (
        <p className="text-sm text-muted-foreground">Loading log…</p>
      ) : logText ? (
        <Terminal
          title={title}
          output={logText}
          status={status}
          defaultOpen
          data-testid="task-terminal"
        />
      ) : (
        <Empty>
          <EmptyTitle>No log output</EmptyTitle>
          <EmptyDescription>
            Nothing written to this stream yet.
          </EmptyDescription>
          <EmptyContent />
        </Empty>
      )}

      {advanced ? (
        <div className="flex flex-col gap-3" data-testid="advanced-logs">
          {command ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Command</p>
              <CodeBlock size="sm" data-testid="advanced-command">
                <CodeBlockContent wrap>{command}</CodeBlockContent>
              </CodeBlock>
            </div>
          ) : null}
          {attempt?.pid !== undefined ? (
            <Item size="sm" variant="outline" data-testid="advanced-pid">
              <ItemContent className="flex-row items-center gap-2">
                <ItemTitle>PID</ItemTitle>
                <Badge variant="secondary">{attempt.pid}</Badge>
              </ItemContent>
            </Item>
          ) : null}
          <EnvironmentVariables
            vars={taskEnvVars(run, task.id, attemptN)}
            data-testid="advanced-env"
          />
          <ToggleGroup
            value={[logStream]}
            onValueChange={(v) => {
              const s = v[0]
              if (s === "stdout" || s === "stderr") setLogStream(s)
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="stdout">stdout</ToggleGroupItem>
            <ToggleGroupItem value="stderr">stderr</ToggleGroupItem>
          </ToggleGroup>
          {logText ? (
            <CodeBlock size="sm" data-testid="advanced-raw-log">
              <CodeBlockContent wrap className="max-h-64">
                {logText}
              </CodeBlockContent>
            </CodeBlock>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
