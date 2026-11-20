import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import type { WorkflowSummary } from "@workspace/shared"
import { workflowSummarySchema } from "@workspace/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"
import { CreateWorkflowDialog } from "@/pages/CreateWorkflowDialog"
import { DeleteWorkflowDialog } from "@/pages/DeleteWorkflowDialog"
import { RenameWorkflowDialog } from "@/pages/RenameWorkflowDialog"
import { WorkflowActions } from "@/pages/WorkflowActions"

export function HomePage() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    runCount: number
  } | null>(null)

  async function reload() {
    const res = await api.workflows.$get()
    if (!res.ok) throw new Error("request failed")
    setWorkflows(workflowSummarySchema.array().parse(await res.json()))
  }

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        await reload()
      } catch {
        if (alive) setError("Could not load workflows")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function openDelete(id: string) {
    const res = await api.workflows[":workflowId"].runs.$get({
      param: { workflowId: id },
    })
    const runCount = res.ok ? ((await res.json()) as unknown[]).length : 0
    setDeleteTarget({ id, runCount })
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!workflows) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-medium">Workflows</h1>
        <Button
          size="sm"
          className="ml-auto"
          data-testid="workflow-create-open"
          onClick={() => setCreateOpen(true)}
        >
          Create
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Empty>
          <EmptyTitle>No workflows</EmptyTitle>
          <EmptyDescription>
            Create a workflow to get started.
          </EmptyDescription>
          <EmptyContent />
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Goal</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell>
                  <Link
                    className="font-mono text-sm underline-offset-4 hover:underline"
                    to={`/workflows/${wf.id}`}
                  >
                    {wf.id}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {wf.goal ?? "—"}
                </TableCell>
                <TableCell>
                  <WorkflowActions
                    workflowId={wf.id}
                    onRename={() => setRenameId(wf.id)}
                    onDelete={() => void openDelete(wf.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          void reload().then(() => navigate(`/workflows/${id}`))
        }}
      />
      {renameId && (
        <RenameWorkflowDialog
          open
          workflowId={renameId}
          onOpenChange={(open) => !open && setRenameId(null)}
          onRenamed={() => void reload()}
        />
      )}
      {deleteTarget && (
        <DeleteWorkflowDialog
          open
          workflowId={deleteTarget.id}
          runCount={deleteTarget.runCount}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onDeleted={() => void reload()}
        />
      )}
    </div>
  )
}
