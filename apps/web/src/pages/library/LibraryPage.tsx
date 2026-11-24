import { useState } from "react"
import { useSearchParams } from "react-router"
import type { ProviderDescriptor } from "@workspace/contracts"
import {
  useFlowsClient,
  useOptionalFlowsClient,
  useQuery,
} from "@workspace/sdk-react"
import { Plug, Plus } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { AddLibraryDialog } from "./AddLibraryDialog"
import { LibraryBody } from "./LibraryBody"
import { LibraryChrome } from "./LibraryChrome"
import { removeItem } from "./library-actions"
import { filterItems, type KindFilter } from "./library-filter"
import { LibrarySheet } from "./LibrarySheet"
import { LibraryEmpty, LibraryLoadError, LibraryLoading } from "./LibraryStates"
import { ProvidersDialog } from "./ProvidersDialog"
import { saveProvider, upsertProvider } from "./provider-actions"

export function LibraryPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <LibraryPageInner />
  return (
    <FlowsClientGate>
      <LibraryPageInner />
    </FlowsClientGate>
  )
}

function LibraryPageInner() {
  const client = useFlowsClient()
  const providersQ = useQuery("library/list_providers", {}, { topics: [] })
  const itemsQ = useQuery("library/list", {}, { topics: ["library"] })
  const [saved, setSaved] = useState<ProviderDescriptor[]>([])
  const [kind, setKind] = useState<KindFilter>("all")
  const [search, setSearch] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [gallery, setGallery] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get("item"))
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const providers = (() => {
    const base = providersQ.data?.items ?? []
    let next = base
    for (const p of saved) next = upsertProvider(next, p)
    return next
  })()
  const items = itemsQ.data?.items ?? []
  const inKind = filterItems(items, kind, "")
  const shown = filterItems(items, kind, search, tags)
  const toggleTag = (t: string) =>
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )

  const loading =
    (providersQ.loading && !providersQ.data) || (itemsQ.loading && !itemsQ.data)
  if (loading) return <LibraryLoading />
  if (
    (providersQ.error && !providersQ.data) ||
    (itemsQ.error && !itemsQ.data)
  ) {
    return <LibraryLoadError error={providersQ.error ?? itemsQ.error} />
  }

  async function onSave(provider: ProviderDescriptor) {
    setBusy(true)
    setConflict(false)
    setActionError(null)
    const result = await saveProvider(client, provider)
    setBusy(false)
    if (result === "conflict") {
      setConflict(true)
      return
    }
    if (result !== "ok") {
      setActionError(result)
      return
    }
    setSaved((prev) => upsertProvider(prev, provider))
  }

  async function onConfirmRemove() {
    if (!deletingId) return
    setBusy(true)
    setActionError(null)
    const result = await removeItem(client, deletingId)
    setBusy(false)
    if (result !== "ok") {
      setActionError(result === "conflict" ? "Conflict removing item" : result)
      return
    }
    setDeletingId(null)
    setOpenId(null)
  }

  return (
    <Page
      crumbs={[{ label: "Library" }]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setProvidersOpen(true)}
            data-testid="library-providers-open"
          >
            <Plug />
            Providers
          </Button>
          <Button onClick={() => setAdding(true)} data-testid="library-add-open">
            <Plus />
            Add to Library
          </Button>
        </div>
      }
      data-testid="mock-library-page"
    >
      <PageTitle
        title="Library"
        description="Local copies of the repositories, pages and tickets tasks refer to. Each item is a local folder. Linked items are fetched from their remote, one version per fetch."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="library-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not save"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "A provider changed on disk. Close Providers and try again."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      <LibraryChrome
        items={items}
        providers={providers}
        kind={kind}
        search={search}
        gallery={gallery}
        onKind={setKind}
        onSearch={setSearch}
        onGallery={setGallery}
      />
      {items.length === 0 ? (
        <LibraryEmpty />
      ) : (
        <LibraryBody
          items={items}
          inKind={inKind}
          shown={shown}
          providers={providers}
          tags={tags}
          gallery={gallery}
          onToggleTag={toggleTag}
          onClearTags={() => setTags([])}
          onOpen={setOpenId}
        />
      )}
      <LibrarySheet
        itemId={openId}
        providers={providers}
        onDelete={setDeletingId}
        onClose={() => setOpenId(null)}
        onError={setActionError}
      />
      <AddLibraryDialog
        open={adding}
        onOpenChange={setAdding}
        items={items}
        providers={providers}
        onAdded={setOpenId}
        onOpenExisting={setOpenId}
        onError={setActionError}
      />
      <ProvidersDialog
        open={providersOpen}
        onOpenChange={setProvidersOpen}
        providers={providers}
        busy={busy}
        onSave={(provider) => void onSave(provider)}
      />
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Remove from Library?"
        description="The local copy and all its versions are deleted. Cards that point at it will show it as missing. The remote is untouched."
        confirmLabel="Remove"
        pending={busy}
        onConfirm={() => void onConfirmRemove()}
      />
    </Page>
  )
}
