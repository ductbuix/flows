import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router"
import { FolderOpen } from "lucide-react"
import type { RunSummary } from "@workspace/shared"
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
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Page, PageTitle } from "@/components/page"
import { RunStatusBadge } from "@/components/RunStatusBadge"
import { useRunsList } from "@/hooks/use-runs-list"
import { workflowPath } from "@/lib/paths"
import { useWorkflows } from "@/lib/workflows-context"

function lastRunByWorkflow(runs: RunSummary[] | null): Map<string, RunSummary> {
  const map = new Map<string, RunSummary>()
  if (!runs) return map
  for (const run of runs) {
    if (!map.has(run.workflowId)) map.set(run.workflowId, run)
  }
  return map
}

export function WorkflowsPage() {
  const navigate = useNavigate()
  const { workflows, error: workflowsError } = useWorkflows()
  const { runs, error: runsError } = useRunsList()
  const [search, setSearch] = useState("")

  const lastRuns = useMemo(() => lastRunByWorkflow(runs), [runs])
  const filtered = useMemo(() => {
    if (!workflows) return null
    const q = search.trim().toLowerCase()
    if (!q) return workflows
    return workflows.filter(
      (wf) =>
        wf.id.toLowerCase().includes(q) ||
        (wf.goal?.toLowerCase().includes(q) ?? false)
    )
  }, [workflows, search])

  const error =
    workflowsError ?? (runsError ? "Could not load last-run data" : null)
  const loading = !error && (!workflows || !runs)

  return (
    <Page crumbs={[{ label: "Workflows" }]} data-testid="workflows-page">
      <PageTitle
        title="Workflows"
        description="Search workflows and open one to edit or start a run."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="space-y-3" data-testid="workflows-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows"
            data-testid="workflows-search"
            className="max-w-sm"
          />
          {filtered!.length === 0 ? (
            <Empty data-testid="workflows-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpen />
                </EmptyMedia>
                <EmptyTitle>
                  {workflows!.length === 0
                    ? "No workflows yet"
                    : "No matching workflows"}
                </EmptyTitle>
                <EmptyDescription>
                  {workflows!.length === 0
                    ? "Create one from the sidebar plus action."
                    : "Try a different search."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table data-testid="workflows-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Last run time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered!.map((wf) => {
                  const last = lastRuns.get(wf.id)
                  return (
                    <TableRow
                      key={wf.id}
                      className="cursor-pointer"
                      data-testid={`workflows-row-${wf.id}`}
                      onClick={() => void navigate(workflowPath(wf.id))}
                    >
                      <TableCell>
                        <Link
                          to={workflowPath(wf.id)}
                          className="font-mono text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {wf.id}
                        </Link>
                      </TableCell>
                      <TableCell>{wf.taskCount}</TableCell>
                      <TableCell>
                        {last ? (
                          <RunStatusBadge
                            status={last.status}
                            needsYou={last.needsYou.length > 0}
                            data-testid={`workflows-last-status-${wf.id}`}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {last?.startedAt ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Page>
  )
}
