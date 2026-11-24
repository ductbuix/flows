import { useState } from "react"
import type { ProviderDescriptor } from "@workspace/contracts"
import {
  useFlowsClient,
  useOptionalFlowsClient,
  useQuery,
} from "@workspace/sdk-react"
import { LayoutGrid, List, Plug, Search } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
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
  const listQ = useQuery("library/list_providers", {}, { topics: [] })
  /** Local overlay until library/update exists to refetch the query. */
  const [saved, setSaved] = useState<ProviderDescriptor[]>([])
  const [kind, setKind] = useState("all")
  const [search, setSearch] = useState("")
  const [gallery, setGallery] = useState(false)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const providers = (() => {
    const base = listQ.data?.items ?? []
    let next = base
    for (const p of saved) next = upsertProvider(next, p)
    return next
  })()

  const loading = listQ.loading && !listQ.data
  if (loading) return <LibraryLoading />
  if (listQ.error && !listQ.data) {
    return <LibraryLoadError error={listQ.error} />
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

  return (
    <Page
      crumbs={[{ label: "Library" }]}
      actions={
        <Button
          variant="outline"
          onClick={() => setProvidersOpen(true)}
          data-testid="library-providers-open"
        >
          <Plug />
          Providers
        </Button>
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
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            <TabsTrigger value="all">All (0)</TabsTrigger>
            {providers.map((p) => (
              <TabsTrigger
                key={p.id}
                value={p.id}
                data-testid={`library-kind-${p.id}`}
              >
                {p.label} (0)
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
      <LibraryEmpty />
      <ProvidersDialog
        open={providersOpen}
        onOpenChange={setProvidersOpen}
        providers={providers}
        busy={busy}
        onSave={(provider) => void onSave(provider)}
      />
    </Page>
  )
}
