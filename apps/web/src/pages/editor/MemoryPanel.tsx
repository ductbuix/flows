import { useEffect, useState } from "react"
import type { MemoryFileSummary } from "@workspace/shared"
import { memoryListSchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { api } from "@/lib/api"
import { MemoryEditorDialog } from "./MemoryEditorDialog"
import { MemoryFileDialogs } from "./MemoryFileDialogs"

type Props = {
  workflowId: string
}

export function MemoryPanel({ workflowId }: Props) {
  const [files, setFiles] = useState<MemoryFileSummary[]>([])
  const [newName, setNewName] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MemoryFileSummary | null>(
    null
  )
  const [pendingRename, setPendingRename] = useState<MemoryFileSummary | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].memory.$get({
        param: { workflowId },
      })
      if (!res.ok || !alive) return
      setFiles(memoryListSchema.parse(await res.json()).files)
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  async function reload() {
    const res = await api.workflows[":workflowId"].memory.$get({
      param: { workflowId },
    })
    if (!res.ok) return
    setFiles(memoryListSchema.parse(await res.json()).files)
  }

  async function createFile() {
    setError(null)
    const name = newName.trim().endsWith(".md")
      ? newName.trim()
      : `${newName.trim()}.md`
    const res = await api.workflows[":workflowId"].memory[":file"].$put({
      param: { workflowId, file: name },
      json: { content: "" },
    })
    if (!res.ok) {
      setError("Could not create memory file.")
      return
    }
    setNewName("")
    await reload()
    setEditing(name)
  }

  return (
    <div className="space-y-3" data-testid="memory-list">
      <h2 className="text-sm font-medium">Memory files</h2>
      <p className="text-xs text-muted-foreground">
        Edits apply to future launches only. Running and past attempts keep the
        copy they got.
      </p>
      <ul className="space-y-1">
        {files.map((f) => (
          <li
            key={f.name}
            className="flex items-center gap-2 text-sm"
            data-testid={`memory-row-${f.name}`}
          >
            <button
              type="button"
              className="font-mono underline-offset-4 hover:underline"
              onClick={() => setEditing(f.name)}
            >
              {f.name}
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingRename(f)}
            >
              Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingDelete(f)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          data-testid="memory-new-name"
          placeholder="notes.md"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          size="sm"
          data-testid="memory-create"
          disabled={!newName.trim()}
          onClick={() => void createFile()}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {editing && (
        <MemoryEditorDialog
          workflowId={workflowId}
          fileName={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          onSaved={() => void reload()}
        />
      )}

      <MemoryFileDialogs
        workflowId={workflowId}
        pendingDelete={pendingDelete}
        pendingRename={pendingRename}
        onClearDelete={() => setPendingDelete(null)}
        onClearRename={() => setPendingRename(null)}
        onChanged={() => void reload()}
        onError={setError}
      />
    </div>
  )
}
