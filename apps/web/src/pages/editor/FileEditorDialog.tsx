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
import { mono } from "@/components/data/mono"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  path: string
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
  path,
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
      <DialogContent className="sm:max-w-xl" data-testid={editorTestId}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <span className={`${mono} text-xs`}>{path}</span>. {description}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          rows={14}
          className={`${mono} min-h-70 text-xs`}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          {onRemove && removeTestId ? (
            <Button
              variant="destructive"
              className="sm:mr-auto"
              data-testid={removeTestId}
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
