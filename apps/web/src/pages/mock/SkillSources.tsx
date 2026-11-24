import { useState } from "react"
import { Link } from "react-router"
import { RefreshCw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { mono } from "@/components/data/mono"
import { addRemote, fetchItem, useLibrary } from "./library-store"
import { DetectCard, LinkInput, useLinkField } from "./ProviderDetect"
import { addSource, removeSource, skillsOf, useSources } from "./skills-store"

function SourceRow({ id }: { id: string }) {
  const item = useLibrary().find((i) => i.id === id)
  const [busy, setBusy] = useState(false)
  if (!item) return null
  return (
    <div
      className="flex min-h-14 items-center gap-3 rounded-xl px-3 ring-1 ring-foreground/10"
      data-testid={`skill-source-${id}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {item.title}{" "}
          <span className={`${mono} text-xs font-normal text-muted-foreground`}>
            {item.remoteId}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {skillsOf(id).length} skills · v{item.current} · fetched{" "}
          {item.versions[0]?.at.slice(0, 10)} ·{" "}
          <Link to={`/mock/library?item=${id}`} className="underline">
            Open in Library
          </Link>
        </span>
      </div>
      <Button
        variant="outline"
        disabled={busy}
        data-testid={`skill-sync-${id}`}
        onClick={() => {
          setBusy(true)
          setTimeout(() => {
            fetchItem(id)
            setBusy(false)
          }, 900)
        }}
      >
        {busy ? <Spinner /> : <RefreshCw />}
        {busy ? "Syncing…" : "Sync"}
      </Button>
      <Button variant="ghost" onClick={() => removeSource(id)}>
        Remove
      </Button>
    </div>
  )
}

export function SourcesList() {
  const ids = useSources()
  return (
    <div className="flex flex-col gap-2" data-testid="skill-sources">
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sources yet. Add a GitHub repo that keeps skills under skills/.
        </p>
      ) : (
        ids.map((id) => <SourceRow key={id} id={id} />)
      )}
    </div>
  )
}

/** A source is a GitHub repo, so it is a Library item: fetching and versions come for free. */
export function AddSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const link = useLinkField()
  const sources = useSources()
  const isGithub = link.match?.provider.id === "github"
  const taken = !!link.existing && sources.includes(link.existing.id)
  function close(o: boolean) {
    if (!o) link.setUrl("")
    onOpenChange(o)
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="skill-source-add">
        <DialogHeader>
          <DialogTitle>Add skill source</DialogTitle>
          <DialogDescription>
            A GitHub repo with skill folders under skills/. It is fetched into
            the Library, so you can sync it any time.
          </DialogDescription>
        </DialogHeader>
        <LinkInput url={link.url} onUrl={link.setUrl} />
        {link.url && link.match && !isGithub ? (
          <p className="text-sm text-destructive">
            Only GitHub repos can be skill sources.
          </p>
        ) : (
          <DetectCard
            url={link.url}
            match={link.match}
            existing={link.existing}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!isGithub || taken}
            data-testid="skill-source-submit"
            onClick={() => {
              if (!link.match) return
              addSource(link.existing?.id ?? addRemote(link.match))
              close(false)
            }}
          >
            {link.existing && !taken ? "Use as source" : "Add and fetch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
