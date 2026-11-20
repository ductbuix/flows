import { useState } from "react"
import { memoryFileNameSchema } from "@workspace/shared"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel } from "@workspace/ui/components/field"
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
  basename: string
  existingNames: string[]
  onOpenChange: (open: boolean) => void
  onOverwrite: (name: string) => void
  onAdd: (name: string) => void
}

/** Remount with key={basename} when a new collision opens. */
export function MemoryCollisionDialog({
  open,
  basename,
  existingNames,
  onOpenChange,
  onOverwrite,
  onAdd,
}: Props) {
  const [name, setName] = useState(basename)

  const normalized = name.trim().endsWith(".md")
    ? name.trim()
    : name.trim()
      ? `${name.trim()}.md`
      : ""
  const valid = memoryFileNameSchema.safeParse(normalized).success
  const collides = existingNames.includes(normalized)
  const sameAsOriginal = normalized === basename

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="memory-collision">
        <DialogHeader>
          <DialogTitle>{basename} already exists</DialogTitle>
          <DialogDescription>
            Overwrite the existing file, or change the name and add.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="memory-collision-name">File name</FieldLabel>
          <Input
            id="memory-collision-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="memory-collision-overwrite"
            variant="destructive"
            disabled={!sameAsOriginal || !valid}
            onClick={() => onOverwrite(basename)}
          >
            Overwrite
          </Button>
          <Button
            data-testid="memory-collision-add"
            disabled={!valid || collides}
            onClick={() => onAdd(normalized)}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
