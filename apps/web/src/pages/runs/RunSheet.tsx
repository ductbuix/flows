import { useState } from "react"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Sheet, SheetContent } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { errorMessage } from "@/lib/fcp-error"
import { cancelRun, deleteRun, rerunRun } from "./run-actions"
import { RunSheetContent } from "./RunSheetContent"

type Props = {
  runId: string | null
  onClose: () => void
  onReran: (runId: string) => void
  onDeleted: () => void
  onConflict: () => void
  onError: (message: string) => void
}

export function RunSheet({
  runId,
  onClose,
  onReran,
  onDeleted,
  onConflict,
  onError,
}: Props) {
  return (
    <Sheet open={runId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="runs-sheet"
      >
        {runId ? (
          <RunSheetBody
            key={runId}
            runId={runId}
            onClose={onClose}
            onReran={onReran}
            onDeleted={onDeleted}
            onConflict={onConflict}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function RunSheetBody({
  runId,
  onClose,
  onReran,
  onDeleted,
  onConflict,
  onError,
}: {
  runId: string
  onClose: () => void
  onReran: (runId: string) => void
  onDeleted: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const detailQ = useQuery(
    "run/get",
    { id: runId },
    { topics: [`run:${runId}`] }
  )
  const [pending, setPending] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const run = detailQ.data

  async function handle(
    kind: string,
    action: () => Promise<
      | { ok: true; runId?: string }
      | { ok: false; kind: "conflict" | "error"; message: string }
    >,
    onOk: (result: { ok: true; runId?: string }) => void
  ) {
    setPending(kind)
    const result = await action()
    setPending(null)
    if (result.ok) {
      onOk(result)
      return
    }
    if (result.kind === "conflict") onConflict()
    else onError(result.message)
  }

  if (detailQ.loading && !run) {
    return (
      <div className="space-y-3" data-testid="runs-sheet-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (detailQ.error || !run) {
    return (
      <Alert variant="destructive" data-testid="runs-sheet-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {detailQ.error ? errorMessage(detailQ.error) : "Run not found."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <RunSheetContent
      run={run}
      pending={pending}
      cancelOpen={cancelOpen}
      deleteOpen={deleteOpen}
      setCancelOpen={setCancelOpen}
      setDeleteOpen={setDeleteOpen}
      onCancel={() =>
        void handle(
          "cancel",
          () => cancelRun(client, runId),
          () => {
            setCancelOpen(false)
          }
        )
      }
      onRerun={() =>
        void handle(
          "rerun",
          () => rerunRun(client, runId),
          (r) => {
            if (r.runId) onReran(r.runId)
          }
        )
      }
      onDelete={() =>
        void handle(
          "delete",
          () => deleteRun(client, runId),
          () => {
            setDeleteOpen(false)
            onDeleted()
            onClose()
          }
        )
      }
    />
  )
}
