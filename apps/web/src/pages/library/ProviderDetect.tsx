import type {
  LibItem,
  ProviderDescriptor,
  ProviderMatch,
} from "@workspace/contracts"
import { detect } from "@workspace/contracts"
import { CircleCheck, CircleHelp } from "lucide-react"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { Input } from "@workspace/ui/components/input"
import { mono } from "@/components/data/mono"
import { FilesTree, folderPaths } from "@/components/FilesTree"
import { TagBadge } from "./LibraryTags"

export function findExisting(
  match: ProviderMatch | null,
  items: readonly LibItem[]
): LibItem | undefined {
  if (!match) return undefined
  return items.find(
    (i) => i.source === match.provider.id && i.remoteId === match.id
  )
}

export function matchLink(
  url: string,
  providers: readonly ProviderDescriptor[]
): ProviderMatch | null {
  return detect(url, providers)
}

export function LinkInput({
  url,
  onUrl,
}: {
  url: string
  onUrl: (value: string) => void
}) {
  return (
    <Input
      autoFocus
      value={url}
      onChange={(e) => onUrl(e.target.value)}
      placeholder="Paste a link from a provider, like Rally, Confluence or GitHub"
      aria-label="Remote link"
      data-testid="library-link-url"
    />
  )
}

/** What a link resolves to and what a fetch will write, before anything is added. */
export function DetectCard({
  url,
  match,
  existing,
  onOpenExisting,
}: {
  url: string
  match: ProviderMatch | null
  existing?: LibItem
  onOpenExisting?: (id: string) => void
}) {
  if (!url.trim()) return null
  if (!match) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleHelp />
        No provider matches this link. Add its provider under Providers.
      </p>
    )
  }
  const folder = `library/${match.provider.id}/${match.id.replace(/[^a-z0-9._-]+/gi, "__")}/`
  const nodes = pathsToFileTree(match.provider.layout)
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-3 ring-1 ring-foreground/10"
      data-testid="library-detected"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="text-success" />
        {match.provider.label} <span className={mono}>{match.id}</span>
      </p>
      {existing ? (
        <p className="text-sm text-muted-foreground">
          Already in the Library
          {onOpenExisting ? (
            <>
              {" · "}
              <button
                type="button"
                className="underline"
                onClick={() => onOpenExisting(existing.id)}
              >
                Open it
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {match.provider.access === "readwrite"
              ? "Read and write"
              : "Read-only"}{" "}
            · fetches into <span className={mono}>{folder}</span>
          </p>
          <FilesTree
            nodes={nodes}
            open={new Set(folderPaths(nodes))}
            selected={null}
            onToggle={() => {}}
            onSelect={() => {}}
          />
          <div className="flex flex-wrap gap-1">
            {match.provider.tags.map((t) => (
              <TagBadge key={t} tag={t.replaceAll("{id}", match.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
