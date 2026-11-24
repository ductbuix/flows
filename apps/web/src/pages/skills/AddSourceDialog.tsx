import { useState } from "react"
import type { LibItem } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { mono } from "@/components/data/mono"
import { saveSources } from "./skill-actions"

/** Pick an existing GitHub Library item to use as a skill source. */
export function AddSourceDialog({
  open,
  onOpenChange,
  sourceIds,
  items,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  sourceIds: string[]
  items: LibItem[]
}) {
  const client = useFlowsClient()
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const github = items.filter((i) => i.source === "github")
  const match =
    github.find(
      (i) =>
        i.remoteUrl === url.trim() ||
        i.remoteId === url.trim() ||
        i.id === url.trim()
    ) ?? null
  const taken = !!match && sourceIds.includes(match.id)
  const candidates = github.filter((i) => !sourceIds.includes(i.id))

  function close(o: boolean) {
    if (!o) {
      setUrl("")
      setError(null)
    }
    onOpenChange(o)
  }

  async function add(id: string) {
    setBusy(true)
    setError(null)
    const result = await saveSources(client, [...sourceIds, id])
    setBusy(false)
    if (result !== "ok") {
      setError(result === "conflict" ? "Conflict saving sources" : result)
      return
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="skill-source-add">
        <DialogHeader>
          <DialogTitle>Add skill source</DialogTitle>
          <DialogDescription>
            A GitHub repo already in the Library with skill folders under
            skills/. Sync it any time from the Sources tab.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a GitHub repo URL or remote id"
          aria-label="Remote link"
          data-testid="skill-source-url"
        />
        {url && !match ? (
          <p className="text-sm text-muted-foreground">
            No matching GitHub Library item. Add the repo in Library first.
          </p>
        ) : null}
        {match && taken ? (
          <p className="text-sm text-destructive">Already a skill source.</p>
        ) : null}
        {match && !taken ? (
          <p className="text-sm text-muted-foreground">
            Use <span className="font-medium">{match.title}</span> as a source.
          </p>
        ) : null}
        {candidates.length > 0 && !url ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Or pick one:</p>
            {candidates.map((i) => (
              <button
                key={i.id}
                type="button"
                className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                data-testid={`skill-source-pick-${i.id}`}
                onClick={() => setUrl(i.remoteUrl ?? i.id)}
              >
                {i.title}
                {i.remoteId ? (
                  <span
                    className={`${mono} ml-2 text-xs text-muted-foreground`}
                  >
                    {i.remoteId}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!match || taken || busy}
            data-testid="skill-source-submit"
            onClick={() => match && void add(match.id)}
          >
            Use as source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
