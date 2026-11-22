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
import { EnvironmentVariables } from "@/components/data/EnvironmentVariables"
import { taskCommandLine, taskEnvVars } from "./task-env"
import { useTaskLog, type LogStream } from "./useTaskLog"

type Props = {
  run: RunDetail
  task: TaskView
  attempt: AttemptView | undefined
  attemptN: number
}

/** Command, pid, env templates and raw stdout/stderr (always visible). */
export function TaskDetailEnvironment({ run, task, attempt, attemptN }: Props) {
  const [logStream, setLogStream] = useState<LogStream>("stdout")
  const { text: logText, loading: logLoading } = useTaskLog(
    run.id,
    task.id,
    attemptN,
    logStream
  )
  const command = taskCommandLine(run, task.id)

  return (
    <div className="flex flex-col gap-3" data-testid="task-environment">
      {command ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Command</p>
          <CodeBlock size="sm" data-testid="task-env-command">
            <CodeBlockContent wrap>{command}</CodeBlockContent>
          </CodeBlock>
        </div>
      ) : null}
      {attempt?.pid !== undefined ? (
        <Item size="sm" variant="outline" data-testid="task-env-pid">
          <ItemContent className="flex-row items-center gap-2">
            <ItemTitle>PID</ItemTitle>
            <Badge variant="secondary">{attempt.pid}</Badge>
          </ItemContent>
        </Item>
      ) : null}
      <EnvironmentVariables
        vars={taskEnvVars(run, task.id, attemptN)}
        data-testid="task-env-vars"
      />
      <ToggleGroup
        value={[logStream]}
        onValueChange={(v) => {
          const s = v[0]
          if (s === "stdout" || s === "stderr") setLogStream(s)
        }}
        variant="outline"
      >
        <ToggleGroupItem value="stdout">stdout</ToggleGroupItem>
        <ToggleGroupItem value="stderr">stderr</ToggleGroupItem>
      </ToggleGroup>
      {logLoading && !logText ? (
        <p className="text-sm text-muted-foreground">Loading log…</p>
      ) : logText ? (
        <CodeBlock size="sm" data-testid="task-env-raw-log">
          <CodeBlockContent wrap className="max-h-64">
            {logText}
          </CodeBlockContent>
        </CodeBlock>
      ) : (
        <Empty>
          <EmptyTitle>No log output</EmptyTitle>
          <EmptyDescription>
            Nothing written to this stream yet.
          </EmptyDescription>
          <EmptyContent />
        </Empty>
      )}
    </div>
  )
}
