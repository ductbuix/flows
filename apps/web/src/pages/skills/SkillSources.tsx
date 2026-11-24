import { useState } from "react"
import { Link } from "react-router"
import { RefreshCw } from "lucide-react"
import type { LibItem, WireSkillSource } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { mono } from "@/components/data/mono"
import { pullItem } from "@/pages/library/library-actions"
import { saveSources } from "./skill-actions"

function SourceRow({
  source,
  item,
  sourceIds,
}: {
  source: WireSkillSource
  item: LibItem | undefined
  sourceIds: string[]
}) {
  const client = useFlowsClient()
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const id = source.id
  const title = item?.title ?? id
  const fetched = item?.versions[0]?.at?.slice(0, 10)

  async function onSync() {
    setBusy(true)
    await pullItem(client, id)
    setBusy(false)
  }

  async function onRemove() {
    setRemoving(true)
    await saveSources(
      client,
      sourceIds.filter((s) => s !== id)
    )
    setRemoving(false)
  }

  return (
    <div
      className="flex min-h-14 items-center gap-3 rounded-xl px-3 ring-1 ring-foreground/10"
      data-testid={`skill-source-${id}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {title}{" "}
          {item?.remoteId ? (
            <span
              className={`${mono} text-xs font-normal text-muted-foreground`}
            >
              {item.remoteId}
            </span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {source.skills.length} skills
          {item ? ` · v${item.current}` : ""}
          {fetched ? ` · fetched ${fetched}` : ""}
          {" · "}
          <Link to={`/library?item=${id}`} className="underline">
            Open in Library
          </Link>
        </span>
      </div>
      <Button
        variant="outline"
        disabled={busy || !item?.remoteId}
        data-testid={`skill-sync-${id}`}
        onClick={() => void onSync()}
      >
        {busy ? <Spinner /> : <RefreshCw />}
        {busy ? "Syncing…" : "Sync"}
      </Button>
      <Button
        variant="ghost"
        disabled={removing}
        onClick={() => void onRemove()}
        data-testid={`skill-source-remove-${id}`}
      >
        Remove
      </Button>
    </div>
  )
}

export function SourcesList({
  sources,
  items,
}: {
  sources: WireSkillSource[]
  items: LibItem[]
}) {
  const byId = new Map(items.map((i) => [String(i.id), i]))
  const sourceIds = sources.map((s) => s.id)
  return (
    <div className="flex flex-col gap-2" data-testid="skill-sources">
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sources yet. Add a GitHub repo that keeps skills under skills/.
        </p>
      ) : (
        sources.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            item={byId.get(s.id)}
            sourceIds={sourceIds}
          />
        ))
      )}
    </div>
  )
}

/** Keep a live library list for source rows (titles, sync). */
export function useLibraryItems(): LibItem[] {
  const q = useQuery("library/list", {}, { topics: ["library"] })
  return q.data?.items ?? []
}
