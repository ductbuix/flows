import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"

type Props = {
  open: boolean
  diskYaml: string
  mineYaml: string
  onReload: () => void
  onKeep: () => void
  onShowDiff: () => void
  showingDiff: boolean
}

export function ConflictDialog({
  open,
  diskYaml,
  mineYaml,
  onReload,
  onKeep,
  onShowDiff,
  showingDiff,
}: Props) {
  return (
    <Dialog open={open}>
      <DialogContent data-testid="conflict-dialog" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>workflow.yaml changed on disk</DialogTitle>
          <DialogDescription>
            The file changed outside the editor. Reload to discard your edits,
            or keep yours and overwrite on the next save.
          </DialogDescription>
        </DialogHeader>
        {showingDiff && (
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto text-xs">
            <pre className="rounded border p-2 whitespace-pre-wrap">
              {diskYaml}
            </pre>
            <pre className="rounded border p-2 whitespace-pre-wrap">
              {mineYaml}
            </pre>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button data-testid="conflict-reload" onClick={onReload}>
            Reload from disk
          </Button>
          <Button
            data-testid="conflict-keep"
            variant="secondary"
            onClick={onKeep}
          >
            Keep mine
          </Button>
          <Button
            data-testid="conflict-diff"
            variant="outline"
            onClick={onShowDiff}
          >
            {showingDiff ? "Hide diff" : "Show diff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
