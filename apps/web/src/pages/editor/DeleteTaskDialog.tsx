import type { MentionHit, TaskLabel } from "@workspace/shared"
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
            <span className="block text-amber-700 dark:text-amber-400">
              Other tasks still mention this id or its UPSTREAM env var:{" "}
              {mentions.map((m) => `${m.label} (${m.where})`).join(", ")}. Save
              will move the folder anyway.
            </span>
          ) : null}
        </span>
      }
    />
  )
}
