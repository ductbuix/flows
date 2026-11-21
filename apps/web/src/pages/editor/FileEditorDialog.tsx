import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Textarea } from "@workspace/ui/components/textarea"
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
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  editorTestId: string
  saveTestId: string
  removeTestId?: string
  content: string
  onContentChange: (value: string) => void
  error: string | null
  busy: boolean
  onSave: () => void
  onRemove?: () => void
}

/** Plain textarea editor for memory and prompt files (DES-018). */
export function FileEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  editorTestId,
  saveTestId,
  removeTestId,
  content,
  onContentChange,
  error,
  busy,
  onSave,
  onRemove,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid={editorTestId}>
        <DialogHeader>
          <DialogTitle className="font-mono">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={14}
          className="min-h-70 font-mono text-xs"
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {onRemove && removeTestId ? (
            <Button
              variant="destructive"
              data-testid={removeTestId}
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              data-testid={saveTestId}
              disabled={busy}
              onClick={() => void onSave()}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
