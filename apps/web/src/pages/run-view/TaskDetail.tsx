import { useState } from "react"
import type { RunDetail, TaskView } from "@workspace/shared"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { PromoteButton } from "./PromoteButton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { AttemptKindBadge } from "./AttemptKindBadge"
import { TaskActions } from "./TaskActions"
import { TaskDetailSummary } from "./TaskDetailSummary"
import { TaskDetailOutput } from "./TaskDetailOutput"
import { useTaskLog, type LogStream } from "./useTaskLog"

type Props = {
  run: RunDetail
  task: TaskView
}

function latestAttempt(task: TaskView): number {
  const last = task.attempts.at(-1)
  return last?.attempt ?? 1
}

export function TaskDetail({ run, task }: Props) {
  const attemptN = latestAttempt(task)
  const [logStream, setLogStream] = useState<LogStream>("stdout")
  const { text: logText, loading: logLoading } = useTaskLog(
    run.id,
    task.id,
    attemptN,
    logStream
  )

  const spawnedChildren = run.tasks.filter((t) => t.spawnedBy === task.id)

  return (
    <Tabs defaultValue="logs" className="flex h-full flex-col gap-2">
      <TaskActions run={run} task={task} />
      <TabsList variant="line">
        <TabsTrigger value="logs" data-testid="task-tab-logs">
          Logs
        </TabsTrigger>
        <TabsTrigger value="attempts" data-testid="task-tab-attempts">
          Attempts
        </TabsTrigger>
        <TabsTrigger value="summary" data-testid="task-tab-summary">
          Summary
        </TabsTrigger>
        <TabsTrigger value="output" data-testid="task-tab-output">
          Output
        </TabsTrigger>
        <TabsTrigger value="spawn" data-testid="task-tab-spawn">
          Spawn
        </TabsTrigger>
      </TabsList>

      <TabsContent value="logs" className="min-h-0 flex-1">
        <ToggleGroup
          value={[logStream]}
          onValueChange={(v) => {
            const s = v[0]
            if (s === "stdout" || s === "stderr") setLogStream(s)
          }}
          variant="outline"
          size="sm"
          className="mb-2"
        >
          <ToggleGroupItem value="stdout">stdout</ToggleGroupItem>
          <ToggleGroupItem value="stderr">stderr</ToggleGroupItem>
        </ToggleGroup>
        {logLoading && !logText ? (
          <p className="text-sm text-muted-foreground">Loading log…</p>
        ) : logText ? (
          <ScrollArea className="h-[min(50vh,400px)] rounded-md border bg-muted/30 p-2">
            <pre
              data-testid="log-output"
              className="font-mono text-xs whitespace-pre-wrap"
            >
              {logText}
            </pre>
          </ScrollArea>
        ) : (
          <Empty>
            <EmptyTitle>No log output</EmptyTitle>
            <EmptyDescription>
              Nothing written to this stream yet.
            </EmptyDescription>
            <EmptyContent />
          </Empty>
        )}
      </TabsContent>

      <TabsContent value="attempts">
        {task.attempts.length === 0 ? (
          <Empty>
            <EmptyTitle>Not started</EmptyTitle>
            <EmptyDescription>This task has no attempts yet.</EmptyDescription>
            <EmptyContent />
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>PID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {task.attempts.map((a) => (
                <TableRow
                  key={a.attempt}
                  data-testid={`attempt-row-${a.attempt}`}
                >
                  <TableCell>{a.attempt}</TableCell>
                  <TableCell>
                    <AttemptKindBadge kind={a.kind} attempt={a.attempt} />
                  </TableCell>
                  <TableCell>
                    {a.exitCode !== undefined ? a.exitCode : "—"}
                  </TableCell>
                  <TableCell data-testid={`attempt-reason-${a.attempt}`}>
                    {a.reason ?? "—"}
                  </TableCell>
                  <TableCell>{a.pid ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="summary">
        <TaskDetailSummary
          runId={run.id}
          taskId={task.id}
          attemptN={attemptN}
        />
      </TabsContent>

      <TabsContent value="output">
        <TaskDetailOutput runId={run.id} taskId={task.id} attemptN={attemptN} />
      </TabsContent>

      <TabsContent value="spawn">
        {task.failReason === "rejected" && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>Spawn rejected</AlertTitle>
            <AlertDescription>
              The engine rejected spawn specs for this task.
            </AlertDescription>
          </Alert>
        )}
        {task.spawned && (
          <div className="mb-3">
            <PromoteButton runId={run.id} taskId={task.id} />
          </div>
        )}
        {spawnedChildren.length === 0 ? (
          <Empty>
            <EmptyTitle>No spawned tasks</EmptyTitle>
            <EmptyDescription>
              This task has not spawned children in this run.
            </EmptyDescription>
            <EmptyContent />
          </Empty>
        ) : (
          <ul className="text-sm">
            {spawnedChildren.map((child) => (
              <li key={child.id} className="font-mono">
                {child.id}{" "}
                <span className="text-muted-foreground">({child.status})</span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
