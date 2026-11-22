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
import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import type { RunTaskTab } from "@/lib/paths"
import { PromoteButton } from "./PromoteButton"
import { TaskActions } from "./TaskActions"
import { TaskDetailAttempts } from "./TaskDetailAttempts"
import { TaskDetailEnvironment } from "./TaskDetailEnvironment"
import { TaskDetailOutput } from "./TaskDetailOutput"
import { TaskDetailSummary } from "./TaskDetailSummary"
import { TaskDetailTerminal } from "./TaskDetailTerminal"
import { TaskStatusBadge } from "./TaskStatusBadge"

type Props = {
  run: RunDetail
  task: TaskView
  tab: RunTaskTab
  onTabChange: (tab: RunTaskTab) => void
}

function latestAttempt(task: TaskView): number {
  const last = task.attempts.at(-1)
  return last?.attempt ?? 1
}

export function TaskDetail({ run, task, tab, onTabChange }: Props) {
  const attemptN = latestAttempt(task)
  const attempt = task.attempts.at(-1)
  const spawnedChildren = run.tasks.filter((t) => t.spawnedBy === task.id)
  const label = run.graph.tasks.find((t) => t.id === task.id)?.name ?? task.id

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 pl-4"
      data-testid="task-detail"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-base font-medium">{label}</h2>
        <TaskStatusBadge status={task.status} />
        <div className="ml-auto flex items-center gap-2">
          {task.spawned && <PromoteButton runId={run.id} taskId={task.id} />}
          <TaskActions run={run} task={task} />
        </div>
      </div>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (
              v === "output" ||
              v === "terminal" ||
              v === "attempts" ||
              v === "environment"
            ) {
              onTabChange(v)
            }
          }}
          className="flex h-full min-h-0 flex-col gap-2"
        >
          <TabsList variant="line">
            <TabsTrigger value="output" data-testid="task-tab-output">
              Output
            </TabsTrigger>
            <TabsTrigger value="terminal" data-testid="task-tab-terminal">
              Terminal
            </TabsTrigger>
            <TabsTrigger value="attempts" data-testid="task-tab-attempts">
              Attempts
            </TabsTrigger>
            <TabsTrigger value="environment" data-testid="task-tab-environment">
              Environment
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="output"
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <TaskDetailSummary
              runId={run.id}
              taskId={task.id}
              attemptN={attemptN}
            />
            <TaskDetailOutput
              runId={run.id}
              taskId={task.id}
              attemptN={attemptN}
            />
            {task.failReason === "rejected" && (
              <Alert variant="destructive">
                <AlertTitle>Spawn rejected</AlertTitle>
                <AlertDescription>
                  The engine rejected spawn specs for this task.
                </AlertDescription>
              </Alert>
            )}
            {spawnedChildren.length > 0 ? (
              <ItemGroup>
                {spawnedChildren.map((child) => (
                  <Item key={child.id} variant="outline">
                    <ItemContent className="flex-row items-center gap-2">
                      <ItemTitle className={mono}>{child.id}</ItemTitle>
                      <Badge variant="secondary">{child.status}</Badge>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : null}
          </TabsContent>

          <TabsContent
            value="terminal"
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <TaskDetailTerminal
              run={run}
              task={task}
              attempt={attempt}
              attemptN={attemptN}
            />
          </TabsContent>

          <TabsContent value="attempts" className="min-h-0 overflow-auto">
            <TaskDetailAttempts run={run} task={task} />
          </TabsContent>

          <TabsContent value="environment" className="min-h-0 overflow-auto">
            <TaskDetailEnvironment
              run={run}
              task={task}
              attempt={attempt}
              attemptN={attemptN}
            />
          </TabsContent>
        </Tabs>
    </div>
  )
}
