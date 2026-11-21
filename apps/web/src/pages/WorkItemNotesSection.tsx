import { useEffect, useState } from "react"
import {
  workItemNotesConflictSchema,
  workItemNotesSchema,
} from "@workspace/shared"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "sonner"
import { Section } from "@/components/Section"
import { api } from "@/lib/api"

type Props = {
  workItemId: string
}

/** Notes textarea with hash-based save (BL-040). */
export function WorkItemNotesSection({ workItemId }: Props) {
  const [content, setContent] = useState("")
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workitems[":id"].notes.$get({
        param: { id: workItemId },
      })
      if (!alive) return
      if (!res.ok) {
        setError("Could not load notes")
        return
      }
      const notes = workItemNotesSchema.parse(await res.json())
      setContent(notes.content)
      setHash(notes.hash)
      setDirty(false)
      setError(null)
    })()
    return () => {
      alive = false
    }
  }, [workItemId])

  async function save() {
    if (hash === null) return
    setPending(true)
    setError(null)
    try {
      const res = await api.workitems[":id"].notes.$put({
        param: { id: workItemId },
        json: { content, baseHash: hash },
      })
      if (res.status === 409) {
        const conflict = workItemNotesConflictSchema.parse(await res.json())
        setContent(conflict.diskContent)
        setHash(conflict.diskHash)
        setDirty(false)
        setError("Notes changed on disk; reloaded. Edit again to save.")
        return
      }
      if (!res.ok) {
        setError("Could not save notes")
        return
      }
      const notes = workItemNotesSchema.parse(await res.json())
      setContent(notes.content)
      setHash(notes.hash)
      setDirty(false)
      toast.success("Notes saved")
    } catch {
      setError("Could not save notes")
    } finally {
      setPending(false)
    }
  }

  return (
    <Section title="Notes">
      <Textarea
        data-testid="work-item-notes"
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          setDirty(true)
        }}
        rows={6}
        placeholder="Notes for this work item"
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        data-testid="work-item-notes-save"
        disabled={!dirty || pending || hash === null}
        onClick={() => void save()}
      >
        Save notes
      </Button>
    </Section>
  )
}
