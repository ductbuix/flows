import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { FolderOpen, Plus, Search } from "lucide-react"
import {
  useFlowsClient,
  useOptionalFlowsClient,
  useQuery,
} from "@workspace/sdk-react"
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
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { workflowLabel } from "@/lib/labels"
import { WorkflowRowMenu } from "@/pages/mock/WorkflowRowMenu"
import { WorkflowDialogs } from "./WorkflowDialogs"
import { WorkflowSheet } from "./WorkflowSheet"
import { WorkflowsLoadError, WorkflowsLoading } from "./WorkflowsStates"

export function WorkflowsPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <WorkflowsPageInner />
  return (
    <FlowsClientGate>
      <WorkflowsPageInner />
    </FlowsClientGate>
  )
}

function WorkflowsPageInner() {
  const client = useFlowsClient()
  const navigate = useNavigate()
  const listQ = useQuery("workflow/list", {}, { topics: ["workflow"] })
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data?.items])
  const q = search.trim().toLowerCase()
  const shown = useMemo(
    () =>
      items.filter(
        (w) =>
          !q ||
          w.id.toLowerCase().includes(q) ||
          workflowLabel(w).toLowerCase().includes(q) ||
          (w.goal?.toLowerCase().includes(q) ?? false)
      ),
    [items, q]
  )
  const open = items.find((w) => w.id === openId) ?? null
  const loading = listQ.loading && !listQ.data

  function clearErrors() {
    setConflict(false)
    setActionError(null)
  }

  if (loading) return <WorkflowsLoading />
  if (listQ.error) return <WorkflowsLoadError error={listQ.error} />

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Workflows" }]}
      actions={
        <Button
          onClick={() => setCreating(true)}
          data-testid="workflows-new-open"
        >
          <Plus />
          New workflow
        </Button>
      }
      data-testid="mock-workflows-page"
    >
      <PageTitle
        title="Workflows"
        description="Each workflow solves one type of task the same way every time."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="workflows-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "A workflow changed while you were editing. The list reloads from disk."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
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
        <Empty
          className="ring-1 ring-foreground/10"
          data-testid="workflows-empty"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>
              {items.length === 0
                ? "No workflows yet"
                : "No matching workflows"}
            </EmptyTitle>
            <EmptyDescription>
              {items.length === 0
                ? "Create one to get started."
                : "Try a different search."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table data-testid="workflows-table">
          <TableHeader>
            <TableRow>
              <TableHead>Solves</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((w) => (
              <TableRow
                key={w.id}
                className="cursor-pointer"
                onClick={() => setOpenId(w.id)}
                data-testid={`mock-workflow-${w.id}`}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{workflowLabel(w)}</span>
                    <span className="max-w-md truncate text-xs text-muted-foreground">
                      {w.goal ?? w.id}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{w.taskCount}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <WorkflowRowMenu
                    name={workflowLabel(w)}
                    onRename={() => setRenamingId(w.id)}
                    onDelete={() => setDeletingId(w.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <WorkflowDialogs
        client={client}
        items={items}
        creating={creating}
        renamingId={renamingId}
        deletingId={deletingId}
        onCreating={setCreating}
        onRenamingId={setRenamingId}
        onDeletingId={setDeletingId}
        onCreated={(id) => void navigate(`/mock/workflows/${id}`)}
        onConflict={() => setConflict(true)}
        onError={setActionError}
        onClearErrors={clearErrors}
      />
      <WorkflowSheet workflow={open} onClose={() => setOpenId(null)} />
    </Page>
  )
}
