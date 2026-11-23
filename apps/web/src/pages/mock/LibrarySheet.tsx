import { SquareKanban } from "lucide-react"
import { Link } from "react-router"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { CARDS } from "./docket-data"
import type { LibItem } from "./library-data"
import { addTag, pinVersion, removeTag } from "./library-store"
import { KindIcon, useTypeLabel } from "./LibraryViews"
import { TagEditor } from "./LibraryTags"
import { ItemFiles } from "./ItemFiles"
import { RemoteBar } from "./RemoteBlock"
import { LibraryVersions } from "./LibraryVersions"

type Props = {
  item: LibItem | null
  all: LibItem[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

export function LibrarySheet({ item, all, onOpen, onDelete, onClose }: Props) {
  const typeLabel = useTypeLabel()
  const related = item
    ? all
        .filter((o) => o.id !== item.id)
        .map((o) => ({ o, shared: o.tags.filter((t) => item.tags.includes(t)) }))
        .filter((r) => r.shared.length > 0)
        .sort((a, b) => b.shared.length - a.shared.length)
        .slice(0, 3)
    : []
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg" data-testid="library-sheet">
        {item ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="flex items-center gap-2">
                <KindIcon kind={item.kind} className="text-muted-foreground" />
                {item.title}
              </SheetTitle>
              <SheetDescription>
                {typeLabel(item)} · {item.assets.length} {item.assets.length === 1 ? "file" : "files"}
                {item.source !== "local" ? ` · v${item.current}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="mx-4 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
              <RemoteBar item={item} onDelete={() => onDelete(item.id)} />
            </div>
            <Tabs defaultValue="files" className="min-h-0 flex-1 px-4 pt-1">
              <TabsList>
                <TabsTrigger value="files">Files ({item.assets.length})</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="versions" data-testid="library-tab-versions">
                  Versions ({item.versions.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="files" className="overflow-y-auto py-3">
                <ItemFiles key={`${item.id}-${item.assets.length}`} item={item} />
              </TabsContent>
              <TabsContent value="details" className="flex flex-col gap-6 overflow-y-auto py-3">
                <Block title="Tags">
                  <TagEditor
                    tags={item.tags}
                    onAdd={(t) => addTag(item.id, t)}
                    onRemove={(t) => removeTag(item.id, t)}
                  />
                </Block>
                <Block title="Used by cards">
                  {item.usedBy.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No card points here yet</p>
                  ) : (
                    item.usedBy.map((id) => (
                      <Link key={id} to={`/mock/docket?card=${id}`} className="-mx-2 flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                        <SquareKanban className="size-4 text-muted-foreground" />
                        {CARDS.find((c) => c.id === id)?.title ?? id}
                      </Link>
                    ))
                  )}
                </Block>
                {related.length > 0 ? (
                  <Block title="Related">
                    {related.map(({ o, shared }) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onOpen(o.id)}
                        className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                      >
                        <KindIcon kind={o.kind} className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{o.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{shared.length} shared {shared.length === 1 ? "tag" : "tags"}</span>
                      </button>
                    ))}
                  </Block>
                ) : null}
              </TabsContent>
              <TabsContent value="versions" className="overflow-y-auto py-3">
                <LibraryVersions item={item} onPin={(n) => pinVersion(item.id, n)} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
