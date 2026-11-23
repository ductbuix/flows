import { BookOpen, File, FileCode, GitBranch, Globe, Hammer, Image, Link2, ListChecks, ScrollText, Unlink } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useProviders } from "./library-store"
import { mono } from "@/components/data/mono"
import { KIND_SINGULAR, type LibItem, type LibKind } from "./library-data"
import { TagBadge } from "./LibraryTags"

const ICON: Record<LibKind, typeof File> = {
  repo: GitBranch,
  confluence: BookOpen,
  rally: ListChecks,
  ci: Hammer,
  logs: ScrollText,
  web: Globe,
  image: Image,
  html: FileCode,
  other: File,
}

export function KindIcon({ kind, className }: { kind: LibKind; className?: string }) {
  const Icon = ICON[kind]
  return <Icon className={className} />
}

/** Provider name for fetched items, the file type for copies from disk. */
export function useTypeLabel() {
  const providers = useProviders()
  return (i: LibItem) =>
    i.source === "local" ? KIND_SINGULAR[i.kind] : (providers.find((p) => p.id === i.source)?.label ?? i.source)
}

const current = (i: LibItem) => i.versions.find((v) => v.n === i.current) ?? i.versions[0]

function SyncCell({ item, date }: { item: LibItem; date?: boolean }) {
  return item.source === "local" ? (
    <Badge variant="outline">
      <Unlink />
      Not linked
    </Badge>
  ) : (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">
        <Link2 />v{item.current}
      </Badge>
      {date ? <span className="text-muted-foreground">{current(item).at.slice(0, 10)}</span> : null}
    </div>
  )
}

type Props = {
  items: LibItem[]
  active: string[]
  onOpen: (id: string) => void
  onTag: (tag: string) => void
}

export function LibraryTable({ items, active, onOpen, onTag }: Props) {
  const typeLabel = useTypeLabel()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Cards</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow
            key={i.id}
            className="cursor-pointer"
            onClick={() => onOpen(i.id)}
            data-testid={`library-row-${i.id}`}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <KindIcon kind={i.kind} className="text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{i.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {typeLabel(i)}
                    {i.remoteId ? <> · <span className={mono}>{i.remoteId}</span></> : null}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                {i.tags.slice(0, 1).map((t) => (
                  <TagBadge key={t} tag={t} active={active.includes(t)} onClick={() => onTag(t)} />
                ))}
                {i.tags.length > 1 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">+{i.tags.length - 1}</span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              <SyncCell item={i} />
            </TableCell>
            <TableCell>{i.usedBy.length || <span className="text-muted-foreground">—</span>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function LibraryGallery({ items, active, onOpen, onTag }: Props) {
  const typeLabel = useTypeLabel()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <div
          key={i.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(i.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onOpen(i.id)
            }
          }}
          className="flex cursor-pointer flex-col gap-3 rounded-3xl bg-card p-3 text-left ring-1 ring-foreground/10 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`library-tile-${i.id}`}
        >
          <div className="flex h-24 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <KindIcon kind={i.kind} className="size-8" />
          </div>
          <div className="flex flex-col px-1">
            <span className="truncate font-medium">{i.title}</span>
            <span className="text-xs text-muted-foreground">
              {typeLabel(i)} · {i.assets.length} {i.assets.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 px-1" onClick={(e) => e.stopPropagation()}>
            {i.tags.slice(0, 3).map((t) => (
              <TagBadge key={t} tag={t} active={active.includes(t)} onClick={() => onTag(t)} />
            ))}
            {i.tags.length > 3 ? (
              <span className="self-center text-xs text-muted-foreground">+{i.tags.length - 3}</span>
            ) : null}
          </div>
          <div className="px-1 text-xs">
            <SyncCell item={i} date />
          </div>
        </div>
      ))}
    </div>
  )
}
