import { useState } from "react"
import { useNavigate } from "react-router"
import { FolderOpen, Plus, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Page, PageTitle } from "@/components/page"
import { StatusPill } from "@/components/brand/StatusPill"
import { CARDS } from "./docket-data"
import { WorkflowSheet } from "./WorkflowSheet"
import { removeRunsOf, startRun, useRuns } from "./runs-store"
import { addWorkflow, deleteWorkflow, renameWorkflow, useWorkflows } from "./workflows-store"
import { WorkflowRowMenu } from "./WorkflowRowMenu"
import { NewWorkflowDialog } from "./NewWorkflowDialog"

export function WorkflowsMockPage() {
  const runs = useRuns()
  const workflows = useWorkflows()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()
  const shown = workflows.filter(
    (w) =>
      !q ||
      w.name.toLowerCase().includes(q) ||
      w.solves.toLowerCase().includes(q)
  )
  const deleteRuns = runs.filter((r) => r.workflowId === deletingId).length
  const deleteNote =
    deleteRuns === 0
      ? "It has no runs. Cards stay as they are."
      : `Its ${deleteRuns} ${deleteRuns === 1 ? "run is" : "runs are"} deleted too. Cards stay as they are.`
  const open = workflows.find((w) => w.id === openId) ?? null

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Workflows" }]}
      actions={
        <Button onClick={() => setCreating(true)} data-testid="workflows-new-open">
          <Plus />
          New workflow
        </Button>
      }
      data-testid="mock-workflows-page"
    >
      <PageTitle
        title="Workflows"
        description="Each workflow solves one type of task the same way every time. Cards run it, again when reworked. Mock data."
      />
      <InputGroup className="max-w-sm shrink-0">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows"
          data-testid="mock-workflows-search"
        />
      </InputGroup>
      {shown.length === 0 ? (
        <Empty className="ring-1 ring-foreground/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>No matching workflows</EmptyTitle>
            <EmptyDescription>Try a different search.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Solves</TableHead>
              <TableHead>Cards</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((w) => {
              const mine = runs.filter((r) => r.workflowId === w.id)
              const last = mine[0]
              return (
                <TableRow
                  key={w.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(w.id)}
                  data-testid={`mock-workflow-${w.id}`}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{w.name}</span>
                      <span className="max-w-md truncate text-xs text-muted-foreground">
                        {w.solves}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{new Set(mine.map((r) => r.cardId)).size}</TableCell>
                  <TableCell>{mine.length}</TableCell>
                  <TableCell>
                    {last ? (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={last.tone}>{last.label}</StatusPill>
                        <span className="text-muted-foreground">{last.ago}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <WorkflowRowMenu
                      name={w.name}
                      onRename={() => setRenamingId(w.id)}
                      onDelete={() => setDeletingId(w.id)}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      <NewWorkflowDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(name, solves) =>
          void navigate(`/mock/workflows/${addWorkflow(name, solves).id}`)
        }
      />
      {renamingId ? (
        <NewWorkflowDialog
          key={renamingId}
          open
          initial={workflows.find((w) => w.id === renamingId)}
          onOpenChange={(o) => !o && setRenamingId(null)}
          onCreate={(name, solves) => renameWorkflow(renamingId, name, solves)}
        />
      ) : null}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete this workflow?"
        description={deleteNote}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deletingId) return
          removeRunsOf(deletingId)
          deleteWorkflow(deletingId)
          setDeletingId(null)
        }}
      />
      <WorkflowSheet
        workflow={open}
        runs={runs}
        cards={CARDS}
        onStart={startRun}
        onClose={() => setOpenId(null)}
      />
    </Page>
  )
}
