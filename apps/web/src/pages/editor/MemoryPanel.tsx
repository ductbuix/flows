import { useEffect, useState } from "react"
import type { MemoryFileSummary } from "@workspace/shared"
import { memoryFileNameSchema, memoryListSchema } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"
import { MemoryCollisionDialog } from "./MemoryCollisionDialog"
import { MemoryCreateBar } from "./MemoryCreateBar"
import { MemoryEditorDialog } from "./MemoryEditorDialog"
import { MemoryFileDialogs } from "./MemoryFileDialogs"

type Props = {
  workflowId: string
}

type PendingPick = { basename: string; content: string }

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
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null)
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

  async function putMemory(name: string, content: string) {
    const res = await api.workflows[":workflowId"].memory[":file"].$put({
      param: { workflowId, file: name },
      json: { content },
    })
    if (!res.ok) {
      setError("Could not create memory file.")
      return false
    }
    await reload()
    setEditing(name)
    return true
  }

  async function createFile() {
    setError(null)
    const name = newName.trim().endsWith(".md")
      ? newName.trim()
      : `${newName.trim()}.md`
    if (!(await putMemory(name, ""))) return
    setNewName("")
  }

  function onPick(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    const basename = file.name.split(/[/\\]/).pop() ?? ""
    if (!memoryFileNameSchema.safeParse(basename).success) {
      setError("Only .md files can be imported.")
      return
    }
    setError(null)
    void file.text().then((content) => {
      if (files.some((f) => f.name === basename)) {
        setPendingPick({ basename, content })
        return
      }
      void putMemory(basename, content)
    })
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
      <MemoryCreateBar
        newName={newName}
        onNewNameChange={setNewName}
        onCreate={() => void createFile()}
        onPick={onPick}
      />
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
          onRemoved={() => void reload()}
        />
      )}

      {pendingPick && (
        <MemoryCollisionDialog
          key={pendingPick.basename}
          open
          basename={pendingPick.basename}
          existingNames={files.map((f) => f.name)}
          onOpenChange={(open) => {
            if (!open) setPendingPick(null)
          }}
          onOverwrite={(name) => {
            const content = pendingPick.content
            setPendingPick(null)
            void putMemory(name, content)
          }}
          onAdd={(name) => {
            const content = pendingPick.content
            setPendingPick(null)
            void putMemory(name, content)
          }}
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
