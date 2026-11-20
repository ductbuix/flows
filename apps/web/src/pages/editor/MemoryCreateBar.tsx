import { useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

type Props = {
  newName: string
  onNewNameChange: (value: string) => void
  onCreate: () => void
  onPick: (files: FileList | null) => void
}

/** Name field, Add, and .md file picker for memory (DES-018). */
export function MemoryCreateBar({
  newName,
  onNewNameChange,
  onCreate,
  onPick,
}: Props) {
  const pickRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        data-testid="memory-new-name"
        placeholder="notes.md"
        value={newName}
        onChange={(e) => onNewNameChange(e.target.value)}
      />
      <Button
        size="sm"
        data-testid="memory-create"
        disabled={!newName.trim()}
        onClick={onCreate}
      >
        Add
      </Button>
      <input
        ref={pickRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        data-testid="memory-pick"
        onChange={(e) => {
          onPick(e.target.files)
          e.target.value = ""
        }}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => pickRef.current?.click()}
      >
        Import .md
      </Button>
    </div>
  )
}
