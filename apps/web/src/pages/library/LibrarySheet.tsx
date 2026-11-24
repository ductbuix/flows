import { useState } from "react"
import type { ProviderDescriptor } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { pinVersion } from "./library-actions"
import { LibraryFiles } from "./LibraryFiles"
import { LibraryRemote } from "./LibraryRemote"
import { LibraryVersions } from "./LibraryVersions"
import { KindIcon } from "./LibraryKind"
import { TagBadge } from "./LibraryTags"
import { typeLabel } from "./LibraryViews"

type Props = {
  itemId: string | null
  providers: readonly ProviderDescriptor[]
  onDelete: (id: string) => void
  onClose: () => void
  onError: (message: string) => void
}

export function LibrarySheet({
  itemId,
  providers,
  onDelete,
  onClose,
  onError,
}: Props) {
  return (
    <Sheet open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="library-sheet"
      >
        {itemId ? (
          <LibrarySheetBody
            itemId={itemId}
            providers={providers}
            onDelete={onDelete}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function LibrarySheetBody({
  itemId,
  providers,
  onDelete,
  onError,
}: {
  itemId: string
  providers: readonly ProviderDescriptor[]
  onDelete: (id: string) => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const detailQ = useQuery(
    "library/get",
    { id: itemId },
    { topics: ["library"] }
  )
  const [busy, setBusy] = useState(false)
  const item = detailQ.data

  async function onPin(n: number) {
    if (!item) return
    setBusy(true)
    const result = await pinVersion(client, item.id, n)
    setBusy(false)
    if (typeof result === "string") {
      if (result !== "ok" && result !== "conflict") onError(result)
      if (result === "conflict") onError("Conflict pinning version")
    }
  }

  if (detailQ.loading && !item) {
    return (
      <div
        className="flex flex-col gap-3 p-4"
        data-testid="library-sheet-loading"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (!item) {
    return <p className="p-4 text-sm text-muted-foreground">Item not found</p>
  }

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="flex items-center gap-2">
          <KindIcon kind={item.kind} className="text-muted-foreground" />
          {item.title}
        </SheetTitle>
        <SheetDescription>
          {typeLabel(item, providers)}
          {item.source !== "local" ? ` · v${item.current}` : ""}
          {` · ${item.versions.length} ${item.versions.length === 1 ? "version" : "versions"}`}
        </SheetDescription>
      </SheetHeader>
      <div className="mx-4 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
        <LibraryRemote
          item={item}
          providers={providers}
          onDelete={() => onDelete(item.id)}
          onError={onError}
        />
      </div>
      <Tabs defaultValue="files" className="min-h-0 flex-1 px-4 pt-1">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions" data-testid="library-tab-versions">
            Versions ({item.versions.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="overflow-y-auto py-3">
          <LibraryFiles key={`${item.id}-${item.current}`} item={item} />
        </TabsContent>
        <TabsContent
          value="details"
          className="flex flex-col gap-6 overflow-y-auto py-3"
        >
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
            {item.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <TagBadge key={t} tag={t} />
                ))}
              </div>
            )}
          </section>
        </TabsContent>
        <TabsContent value="versions" className="overflow-y-auto py-3">
          <LibraryVersions
            item={item}
            busy={busy}
            onPin={(n) => void onPin(n)}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
