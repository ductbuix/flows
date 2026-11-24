import type { LibItem, ProviderDescriptor } from "@workspace/contracts"
import { Link2, Unlink } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { mono } from "@/components/data/mono"
import { KindIcon, KIND_SINGULAR } from "./LibraryKind"
import { TagBadge } from "./LibraryTags"

export function typeLabel(
  item: LibItem,
  providers: readonly ProviderDescriptor[]
): string {
  if (item.source === "local") return KIND_SINGULAR[item.kind]
  return providers.find((p) => p.id === item.source)?.label ?? item.source
}

function SyncCell({ item, date }: { item: LibItem; date?: boolean }) {
  const current =
    item.versions.find((v) => v.n === item.current) ?? item.versions[0]
  if (item.source === "local") {
    return (
      <Badge variant="outline">
        <Unlink />
        Not linked
      </Badge>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">
        <Link2 />v{item.current}
      </Badge>
      {date && current ? (
        <span className="text-muted-foreground">{current.at.slice(0, 10)}</span>
      ) : null}
    </div>
  )
}

type Props = {
  items: LibItem[]
  providers: readonly ProviderDescriptor[]
  onOpen: (id: string) => void
}

export function LibraryTable({ items, providers, onOpen }: Props) {
  return (
    <Table data-testid="library-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Version</TableHead>
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
                    {typeLabel(i, providers)}
                    {i.remoteId ? (
                      <>
                        {" "}
                        · <span className={mono}>{i.remoteId}</span>
                      </>
                    ) : null}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {i.tags.slice(0, 1).map((t) => (
                  <TagBadge key={t} tag={t} />
                ))}
                {i.tags.length > 1 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    +{i.tags.length - 1}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              <SyncCell item={i} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function LibraryGallery({ items, providers, onOpen }: Props) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="library-gallery"
    >
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
              {typeLabel(i, providers)} · {i.versions.length}{" "}
              {i.versions.length === 1 ? "version" : "versions"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {i.tags.slice(0, 3).map((t) => (
              <TagBadge key={t} tag={t} />
            ))}
            {i.tags.length > 3 ? (
              <span className="self-center text-xs text-muted-foreground">
                +{i.tags.length - 3}
              </span>
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
