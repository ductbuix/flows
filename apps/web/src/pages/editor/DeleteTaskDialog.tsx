import type { MentionHit, TaskLabel } from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { TriangleAlert } from "lucide-react"
import { ConfirmDialog } from "@/components/ConfirmDialog"

type Props = {
  open: boolean
  taskLabel: string
  dependents: TaskLabel[]
  mentions: MentionHit[]
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DeleteTaskDialog({
  open,
  taskLabel: label,
  dependents,
  mentions,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${label}?`}
      confirmLabel="Delete task"
      onConfirm={onConfirm}
      description={
        <span data-testid="delete-task-body" className="block space-y-2">
          <span className="block">
            {dependents.length === 0
              ? "No other tasks depend on this one."
              : `These tasks will lose their link: ${dependents
                  .map((d) => d.label)
                  .join(", ")}.`}
          </span>
          {mentions.length > 0 ? (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Task still referenced</AlertTitle>
              <AlertDescription>
                Other tasks still mention this id or its UPSTREAM env var:{" "}
                {mentions.map((m) => `${m.label} (${m.where})`).join(", ")}.
                Save will move the folder anyway.
              </AlertDescription>
            </Alert>
          ) : null}
        </span>
      }
    />
  )
}
