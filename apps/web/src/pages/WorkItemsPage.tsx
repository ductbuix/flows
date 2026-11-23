import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Briefcase } from "lucide-react"
import type { RunSummary, WorkItemSummary } from "@workspace/shared"
import { workItemSummarySchema } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { useRunsList } from "@/hooks/use-runs-list"
import { api } from "@/lib/api"
import { workItemPath } from "@/lib/paths"
import { CreateWorkItemDialog } from "@/pages/CreateWorkItemDialog"
import { WorkItemsTable } from "@/pages/WorkItemsTable"

function lastRunByWorkItem(runs: RunSummary[] | null): Map<string, RunSummary> {
  const map = new Map<string, RunSummary>()
  if (!runs) return map
  for (const run of runs) {
    if (!run.workItemId || map.has(run.workItemId)) continue
    map.set(run.workItemId, run)
  }
  return map
}

export function WorkItemsPage() {
  const navigate = useNavigate()
  const { runs, error: runsError } = useRunsList()
  const [items, setItems] = useState<WorkItemSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.workitems.$get()
        if (!res.ok) throw new Error("request failed")
        const list = workItemSummarySchema.array().parse(await res.json())
        if (alive) {
          setItems(list)
          setLoadError(null)
        }
      } catch {
        if (alive) setLoadError("Could not load work items")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const lastRuns = useMemo(() => lastRunByWorkItem(runs), [runs])
  const filtered = useMemo(() => {
    if (!items) return null
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.workflowId?.toLowerCase().includes(q) ?? false)
    )
  }, [items, search])

  const error = loadError ?? (runsError ? "Could not load last-run data" : null)
  const loading = !error && (!items || !runs)

  return (
    <Page
      crumbs={[{ label: "Work items" }]}
      data-testid="work-items-page"
      actions={
        <Button
          data-testid="work-items-new"
          onClick={() => setCreateOpen(true)}
        >
          New work item
        </Button>
      }
    >
      <PageTitle
        title="Work items"
        description="Search work items and open one to run a workflow."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="space-y-3" data-testid="work-items-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search work items"
            data-testid="work-items-search"
            className="max-w-sm"
          />
          {filtered!.length === 0 ? (
            <Empty className="ring-1 ring-foreground/10" data-testid="work-items-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Briefcase />
                </EmptyMedia>
                <EmptyTitle>
                  {items!.length === 0
                    ? "No work items yet"
                    : "No matching work items"}
                </EmptyTitle>
                <EmptyDescription>
                  {items!.length === 0
                    ? "Create one to start applying workflows."
                    : "Try a different search."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <WorkItemsTable
              items={filtered!}
              lastRuns={lastRuns}
              onOpen={(id) => void navigate(workItemPath(id))}
            />
          )}
        </>
      )}
      <CreateWorkItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => void navigate(workItemPath(id))}
      />
    </Page>
  )
}
