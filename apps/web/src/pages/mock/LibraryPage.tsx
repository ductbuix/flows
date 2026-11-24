import { useState } from "react"
import { useSearchParams } from "react-router"
import { LayoutGrid, List, Plug, Plus, Search, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Page, PageTitle } from "@/components/page"
import { AddLibraryDialog } from "./AddLibraryDialog"
import { ProvidersDialog } from "./ProvidersDialog"
import { removeItem, useLibrary, useProviders } from "./library-store"
import { LibrarySheet } from "./LibrarySheet"
import { TagBadge, TagRail } from "./LibraryTags"
import { LibraryGallery, LibraryTable } from "./LibraryViews"

type Filter = string

export function LibraryPage() {
  const items = useLibrary()
  const [kind, setKind] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [gallery, setGallery] = useState(false)
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get("item"))
  const [adding, setAdding] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const providers = useProviders()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const q = search.trim().toLowerCase()
  const inKind = items.filter((i) => kind === "all" || i.source === kind)
  const shown = inKind.filter(
    (i) =>
      tags.every((t) => i.tags.includes(t)) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.remoteId?.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)))
  )
  const toggle = (t: string) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const count = (k: Filter) =>
    items.filter((i) => k === "all" || i.source === k).length
  const ids = [...new Set(items.map((i) => i.source))].filter(
    (s) => s !== "local"
  )
  const sources = [
    ...ids.map((id) => ({
      id,
      label: providers.find((p) => p.id === id)?.label ?? `${id} (removed)`,
    })),
    ...(items.some((i) => i.source === "local")
      ? [{ id: "local", label: "Local files" }]
      : []),
  ]
  const View = gallery ? LibraryGallery : LibraryTable

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Library" }]}
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
          <Button
            onClick={() => setAdding(true)}
            data-testid="library-add-open"
          >
            <Plus />
            Add to Library
          </Button>
        </div>
      }
      data-testid="mock-library-page"
    >
      <PageTitle
        title="Library"
        description="Local copies of the repositories, pages and tickets tasks refer to. Each item is a local folder. Linked items are fetched from their remote, one version per fetch. Mock data."
      />
      <div className="flex flex-wrap items-center gap-3">
        <InputGroup className="max-w-sm min-w-48 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, id or tag"
            data-testid="library-search"
          />
        </InputGroup>
        <Tabs value={kind} onValueChange={(v) => setKind(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({count("all")})</TabsTrigger>
            {sources.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                data-testid={`library-kind-${s.id}`}
              >
                {s.label} ({count(s.id)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ButtonGroup className="ml-auto">
          <Button
            variant={gallery ? "outline" : "secondary"}
            size="icon"
            aria-label="List view"
            onClick={() => setGallery(false)}
            data-testid="library-view-list"
          >
            <List />
          </Button>
          <Button
            variant={gallery ? "secondary" : "outline"}
            size="icon"
            aria-label="Gallery view"
            onClick={() => setGallery(true)}
            data-testid="library-view-gallery"
          >
            <LayoutGrid />
          </Button>
        </ButtonGroup>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
        <aside className="md:col-span-1">
          <TagRail items={inKind} active={tags} onToggle={toggle} />
        </aside>
        <div className="flex min-w-0 flex-col gap-4 md:col-span-5">
          {tags.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="library-active-tags"
            >
              <span className="text-sm text-muted-foreground">Tagged</span>
              {tags.map((t) => (
                <TagBadge key={t} tag={t} active onClick={() => toggle(t)} />
              ))}
              <Button variant="ghost" onClick={() => setTags([])}>
                <X />
                Clear
              </Button>
            </div>
          ) : null}
          {shown.length === 0 ? (
            <Empty className="ring-1 ring-foreground/10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>Nothing matches</EmptyTitle>
                <EmptyDescription>
                  Change the search, type or tags.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <View
              items={shown}
              active={tags}
              onOpen={setOpenId}
              onTag={toggle}
            />
          )}
        </div>
      </div>
      <LibrarySheet
        item={items.find((i) => i.id === openId) ?? null}
        all={items}
        onOpen={setOpenId}
        onDelete={setDeletingId}
        onClose={() => setOpenId(null)}
      />
      <AddLibraryDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={setOpenId}
        onOpenExisting={setOpenId}
      />
      <ProvidersDialog open={providersOpen} onOpenChange={setProvidersOpen} />
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Remove from Library?"
        description="The local copy and all its versions are deleted. Cards that point at it will show it as missing. The remote is untouched."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!deletingId) return
          removeItem(deletingId)
          setDeletingId(null)
          setOpenId(null)
        }}
      />
    </Page>
  )
}
