import type { RunDetail, TaskView } from "@workspace/shared"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
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
import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import { PromoteButton } from "./PromoteButton"
import { TaskActions } from "./TaskActions"
import { TaskDetailAttempts } from "./TaskDetailAttempts"
import { TaskDetailLogs } from "./TaskDetailLogs"
import { TaskDetailOutput } from "./TaskDetailOutput"
import { TaskDetailSummary } from "./TaskDetailSummary"

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
  const attempt = task.attempts.at(-1)
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

      <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col gap-2">
        <TaskDetailLogs
          run={run}
          task={task}
          attempt={attempt}
          attemptN={attemptN}
        />
      </TabsContent>

      <TabsContent value="attempts">
        <TaskDetailAttempts run={run} task={task} />
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
          <ItemGroup>
            {spawnedChildren.map((child) => (
              <Item key={child.id} size="sm" variant="outline">
                <ItemContent className="flex-row items-center gap-2">
                  <ItemTitle className="font-mono">{child.id}</ItemTitle>
                  <Badge variant="secondary">{child.status}</Badge>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </TabsContent>
    </Tabs>
  )
}
