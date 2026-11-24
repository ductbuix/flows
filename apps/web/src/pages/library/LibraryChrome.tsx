import type { LibItem, ProviderDescriptor } from "@workspace/contracts"
import { LayoutGrid, List, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ButtonGroup } from "@workspace/ui/components/button-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { countBySource, sourceTabs, type KindFilter } from "./library-filter"

type Props = {
  items: readonly LibItem[]
  providers: readonly ProviderDescriptor[]
  kind: KindFilter
  search: string
  gallery: boolean
  onKind: (kind: KindFilter) => void
  onSearch: (value: string) => void
  onGallery: (gallery: boolean) => void
}

export function LibraryChrome({
  items,
  providers,
  kind,
  search,
  gallery,
  onKind,
  onSearch,
  onGallery,
}: Props) {
  const sources = sourceTabs(items, providers)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InputGroup className="max-w-sm min-w-48 flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, id or tag"
          data-testid="library-search"
        />
      </InputGroup>
      <Tabs value={kind} onValueChange={onKind}>
        <TabsList>
          <TabsTrigger value="all">
            All ({countBySource(items, "all")})
          </TabsTrigger>
          {sources.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              data-testid={`library-kind-${s.id}`}
            >
              {s.label} ({countBySource(items, s.id)})
            </TabsTrigger>
          ))}
          {providers
            .filter((p) => !sources.some((s) => s.id === p.id))
            .map((p) => (
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
          onClick={() => onGallery(false)}
          data-testid="library-view-list"
        >
          <List />
        </Button>
        <Button
          variant={gallery ? "secondary" : "outline"}
          size="icon"
          aria-label="Gallery view"
          onClick={() => onGallery(true)}
          data-testid="library-view-gallery"
        >
          <LayoutGrid />
        </Button>
      </ButtonGroup>
    </div>
  )
}
