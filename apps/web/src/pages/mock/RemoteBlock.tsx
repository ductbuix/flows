import { useState } from "react"
import { ExternalLink, Link2, MoreHorizontal, RefreshCw, Trash2, Unlink, Upload } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Spinner } from "@workspace/ui/components/spinner"
import { mono } from "@/components/data/mono"
import type { LibItem } from "./library-data"
import { fetchItem, linkRemote, pushItem, unlinkRemote, useProviders } from "./library-store"
import { DetectCard, LinkInput, useLinkField } from "./ProviderDetect"

/** One line of status plus the few actions that matter: fetch, and a menu for the rest. */
export function RemoteBar({ item, onDelete }: { item: LibItem; onDelete: () => void }) {
  const [busy, setBusy] = useState(false)
  const link = useLinkField()
  const provider = useProviders().find((p) => p.id === item.source)
  const writable = provider?.access === "readwrite"
  const linked = item.source !== "local"

  function run(action: (id: string) => void) {
    setBusy(true)
    setTimeout(() => {
      action(item.id)
      setBusy(false)
    }, 900)
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" data-testid="library-menu" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {linked && item.remoteUrl ? (
          <DropdownMenuItem render={<a href={item.remoteUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLink />
            Open remote
          </DropdownMenuItem>
        ) : null}
        {linked && writable ? (
          <DropdownMenuItem disabled={busy} onClick={() => run(pushItem)} data-testid="library-push">
            <Upload />
            Push local changes
          </DropdownMenuItem>
        ) : null}
        {linked ? (
          <DropdownMenuItem onClick={() => unlinkRemote(item.id)}>
            <Unlink />
            Unlink from remote
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem variant="destructive" onClick={onDelete} data-testid="library-remove">
          <Trash2 />
          Remove from Library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (!linked)
    return (
      <div className="flex items-center gap-2" data-testid="library-remote">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Only on this machine</p>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" data-testid="library-link-open" />}>
            <Link2 />
            Link to remote
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-96 flex-col gap-3">
            <LinkInput url={link.url} onUrl={link.setUrl} />
            <DetectCard url={link.url} match={link.match} existing={link.existing} />
            <Button
              disabled={!link.match || !!link.existing}
              data-testid="library-link-remote"
              onClick={() => {
                if (!link.match) return
                linkRemote(item.id, link.match)
                link.setUrl("")
              }}
            >
              Link
            </Button>
          </PopoverContent>
        </Popover>
        {menu}
      </div>
    )

  return (
    <div className="flex flex-col gap-1" data-testid="library-remote">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm">
          <Link2 className="mr-1.5 inline text-success" />
          Linked to {provider?.label ?? item.source} <span className={mono}>{item.remoteId}</span>
        </p>
        <Button disabled={busy || !provider} onClick={() => run(fetchItem)} data-testid="library-fetch">
          {busy ? <Spinner /> : <RefreshCw />}
          {busy ? "Working…" : "Fetch"}
        </Button>
        {menu}
      </div>
      <p className="text-xs text-muted-foreground">
        {!provider
          ? "Its provider was removed. Add it back under Providers to fetch."
          : writable
            ? `Last fetched ${item.versions[0]?.at.slice(0, 10)}. Fetch pulls down; Push (menu) sends local edits back.`
            : `Last fetched ${item.versions[0]?.at.slice(0, 10)}. Read-only: nothing is written back.`}
      </p>
    </div>
  )
}
