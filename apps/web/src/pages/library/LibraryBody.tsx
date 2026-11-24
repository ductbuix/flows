import type { LibItem, ProviderDescriptor } from "@workspace/contracts"
import { Search, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { TagBadge, TagRail } from "./LibraryTags"
import { LibraryGallery, LibraryTable } from "./LibraryViews"

type Props = {
  items: LibItem[]
  inKind: LibItem[]
  shown: LibItem[]
  providers: readonly ProviderDescriptor[]
  tags: string[]
  gallery: boolean
  onToggleTag: (tag: string) => void
  onClearTags: () => void
  onOpen: (id: string) => void
}

/** Tag rail plus list/gallery (or empty match). */
export function LibraryBody({
  items,
  inKind,
  shown,
  providers,
  tags,
  gallery,
  onToggleTag,
  onClearTags,
  onOpen,
}: Props) {
  if (items.length === 0) return null
  const View = gallery ? LibraryGallery : LibraryTable
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
      <aside className="md:col-span-1">
        <TagRail items={inKind} active={tags} onToggle={onToggleTag} />
      </aside>
      <div className="flex min-w-0 flex-col gap-4 md:col-span-5">
        {tags.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1.5"
            data-testid="library-active-tags"
          >
            <span className="text-sm text-muted-foreground">Tagged</span>
            {tags.map((t) => (
              <TagBadge key={t} tag={t} active onClick={() => onToggleTag(t)} />
            ))}
            <Button variant="ghost" onClick={onClearTags}>
              <X />
              Clear
            </Button>
          </div>
        ) : null}
        {shown.length === 0 ? (
          <Empty
            className="ring-1 ring-foreground/10"
            data-testid="library-no-match"
          >
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
            providers={providers}
            active={tags}
            onOpen={onOpen}
            onTag={onToggleTag}
          />
        )}
      </div>
    </div>
  )
}
