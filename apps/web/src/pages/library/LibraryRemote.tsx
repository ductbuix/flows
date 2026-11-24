import { useEffect, useState } from "react"
import type { LibItem, ProviderDescriptor } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import {
  ExternalLink,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { mono } from "@/components/data/mono"
import { pullItem } from "./library-actions"

type Props = {
  item: LibItem
  providers: readonly ProviderDescriptor[]
  onDelete: () => void
  onError: (message: string) => void
}

/** Status line plus Fetch and a menu (open remote, remove). */
export function LibraryRemote({ item, providers, onDelete, onError }: Props) {
  const client = useFlowsClient()
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const provider = providers.find((p) => p.id === item.source)
  const linked = item.source !== "local"
  const newest = item.versions[0]

  useEffect(() => {
    if (!jobId) return
    return client.onNotification("library/update", (params) => {
      if (params.kind !== "job_finished" || params.jobId !== jobId) return
      setBusy(false)
      setJobId(null)
      if (!params.ok && params.error) onError(params.error)
    })
  }, [client, jobId, onError])

  async function onFetch() {
    setBusy(true)
    const result = await pullItem(client, item.id)
    if (!result.ok) {
      setBusy(false)
      onError(result.error)
      return
    }
    setJobId(result.jobId)
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="More actions"
            data-testid="library-menu"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {linked && item.remoteUrl ? (
          <DropdownMenuItem
            render={
              <a href={item.remoteUrl} target="_blank" rel="noreferrer" />
            }
          >
            <ExternalLink />
            Open remote
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          data-testid="library-remove"
        >
          <Trash2 />
          Remove from Library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (!linked) {
    return (
      <div className="flex items-center gap-2" data-testid="library-remote">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Only on this machine
        </p>
        {menu}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-testid="library-remote">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm">
          <Link2 className="mr-1.5 inline text-success" />
          Linked to {provider?.label ?? item.source}{" "}
          <span className={mono}>{item.remoteId}</span>
        </p>
        <Button
          disabled={busy || !provider}
          onClick={() => void onFetch()}
          data-testid="library-fetch"
        >
          {busy ? <Spinner /> : <RefreshCw />}
          {busy ? "Working…" : "Fetch"}
        </Button>
        {menu}
      </div>
      <p className="text-xs text-muted-foreground">
        {!provider
          ? "Its provider was removed. Add it back under Providers to fetch."
          : newest
            ? `Last fetched ${newest.at.slice(0, 10)}. Fetch pulls a new version.`
            : "Not fetched yet. Fetch pulls the first version."}
      </p>
    </div>
  )
}
