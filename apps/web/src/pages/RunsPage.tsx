import { useMemo, useState } from "react"
import { Play } from "lucide-react"
import type { RunStatus } from "@workspace/shared"
import { runStatusSchema } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { useRunsList } from "@/hooks/use-runs-list"
import { useWorkItemTitles } from "@/hooks/use-work-item-titles"
import { groupRunsByItem } from "@/lib/group-runs-by-item"
import { useWorkflows } from "@/lib/workflows-context"
import { RunsGroupedTable } from "@/pages/RunsGroupedTable"

const STATUS_ALL = "all"
const WORKFLOW_ALL = "all"
const STATUSES = runStatusSchema.options

export function RunsPage() {
  const { workflows } = useWorkflows()
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_ALL)
  const titles = useWorkItemTitles()

  const filters = useMemo(
    () => ({
      status:
        status !== STATUS_ALL && runStatusSchema.safeParse(status).success
          ? (status as RunStatus)
          : undefined,
      workflowId: workflowId !== WORKFLOW_ALL ? workflowId : undefined,
    }),
    [status, workflowId]
  )

  const { runs, error } = useRunsList(filters)
  const groups = useMemo(
    () => (runs ? groupRunsByItem(runs, titles) : null),
    [runs, titles]
  )

  return (
    <Page crumbs={[{ label: "Runs" }]} data-testid="runs-page">
      <PageTitle
        title="Runs"
        description="All runs across workflows, grouped by work item."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !runs ? (
        <div className="space-y-3" data-testid="runs-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Select value={status} onValueChange={(v) => v && setStatus(v)}>
              <SelectTrigger className="w-44" data-testid="runs-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={workflowId}
              onValueChange={(v) => v && setWorkflowId(v)}
            >
              <SelectTrigger
                className="w-52"
                data-testid="runs-filter-workflow"
              >
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORKFLOW_ALL}>All workflows</SelectItem>
                {(workflows ?? []).map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>
                    {wf.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {runs.length === 0 ? (
            <Empty className="ring-1 ring-foreground/10" data-testid="runs-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Play />
                </EmptyMedia>
                <EmptyTitle>No runs</EmptyTitle>
                <EmptyDescription>
                  Start a run from a workflow, or clear the filters.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <RunsGroupedTable groups={groups!} />
          )}
        </>
      )}
    </Page>
  )
}
