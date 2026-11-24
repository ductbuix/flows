import { MoreHorizontal, RotateCcw, Square } from "lucide-react"
import type { RunSummary } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { StatusPill } from "@/components/brand/StatusPill"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { RelativeTime } from "@/components/data/RelativeTime"
import { mono } from "@/components/data/mono"
import { statusOf } from "./status"

type Props = {
  run: RunSummary
  pending: string | null
  cancelOpen: boolean
  deleteOpen: boolean
  setCancelOpen: (v: boolean) => void
  setDeleteOpen: (v: boolean) => void
  onCancel: () => void
  onRerun: () => void
  onDelete: () => void
}

export function RunSheetContent({
  run,
  pending,
  cancelOpen,
  deleteOpen,
  setCancelOpen,
  setDeleteOpen,
  onCancel,
  onRerun,
  onDelete,
}: Props) {
  const st = statusOf(run.status, run.needsYou.length > 0)
  const live = run.status === "running" || run.status === "queued"

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <SheetTitle>{run.workflowName || run.workflowId}</SheetTitle>
          <StatusPill tone={st.tone}>{st.label}</StatusPill>
        </div>
        <SheetDescription className="flex flex-wrap gap-x-2 gap-y-1">
          <span className={mono}>{run.id}</span>
          <span aria-hidden>·</span>
          <span>
            started <RelativeTime value={run.startedAt} />
          </span>
          <span aria-hidden>·</span>
          <span>
            {run.taskCounts.done}/{run.taskCounts.total} steps
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {live ? (
          <Button
            variant="outline"
            disabled={pending !== null}
            onClick={() => setCancelOpen(true)}
            data-testid="runs-cancel"
          >
            <Square />
            Cancel
          </Button>
        ) : (
          <Button
            disabled={pending !== null}
            onClick={onRerun}
            data-testid="runs-rerun"
          >
            <RotateCcw />
            Run again
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="More"
                data-testid="runs-menu"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              disabled={live || pending !== null}
              data-testid="runs-delete"
              onClick={() => {
                if (!live) setDeleteOpen(true)
              }}
            >
              {live ? "Cancel the run before deleting it" : "Delete run"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {run.needsYou.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Waiting on {run.needsYou.length} approval
          {run.needsYou.length === 1 ? "" : "s"}. Answer them in Inbox.
        </p>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this run?"
        description="Running tasks are stopped. Finished outputs are kept."
        confirmLabel="Cancel run"
        cancelLabel="Keep running"
        pending={pending === "cancel"}
        onConfirm={onCancel}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this run?"
        description="Removes the run directory and drops it from lists. Cannot be undone."
        confirmLabel="Delete run"
        pending={pending === "delete"}
        onConfirm={onDelete}
      />
    </>
  )
}
