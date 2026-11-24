import { useMemo, useState } from "react"
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Page, PageTitle } from "@/components/page"
import { FilePreview } from "./FilePreview"
import { FilesTree, folderPaths } from "./FilesTree"
import { FLOWAPP_PATHS, FLOWAPP_ROOT } from "./mock-data"

/** Read-only look at the local workspace folder (replaces the sidebar tree). */
export function FilesPage() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const q = query.trim().toLowerCase()
  const paths = useMemo(
    () => FLOWAPP_PATHS.filter((p) => p.toLowerCase().includes(q)),
    [q]
  )
  const roots = useMemo(() => pathsToFileTree(paths), [paths])
  const folders = useMemo(() => folderPaths(roots), [roots])
  // While searching, every matching folder is open so hits are visible.
  const shown = q ? new Set(folders) : open
  const allOpen = folders.length > 0 && folders.every((f) => shown.has(f))
  return (
    <Page
      fill
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Files" }]}
      data-testid="mock-files-page"
    >
      <PageTitle
        title="Files"
        description={`Read-only view of ~/${FLOWAPP_ROOT}, the local workspace folder. Mock data.`}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-5">
        <div className="flex min-h-0 flex-col gap-2 rounded-3xl p-2 ring-1 ring-foreground/10 md:col-span-2">
          <div className="flex items-center gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files"
                data-testid="files-search"
              />
            </InputGroup>
            <Button
              variant="outline"
              size="icon"
              disabled={q !== ""}
              aria-label={allOpen ? "Collapse all" : "Expand all"}
              title={allOpen ? "Collapse all" : "Expand all"}
              data-testid="files-toggle-all"
              onClick={() => setOpen(allOpen ? new Set() : new Set(folders))}
            >
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </Button>
          </div>
          <p
            className="px-1 text-xs text-muted-foreground"
            data-testid="files-count"
          >
            {paths.length} {paths.length === 1 ? "file" : "files"}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {paths.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No matching files</EmptyTitle>
                  <EmptyDescription>Try a different search.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <FilesTree
                nodes={roots}
                open={shown}
                selected={selected}
                onToggle={(path, o) =>
                  setOpen((prev) => {
                    const next = new Set(prev)
                    if (o) next.add(path)
                    else next.delete(path)
                    return next
                  })
                }
                onSelect={setSelected}
              />
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto rounded-3xl ring-1 ring-foreground/10 md:col-span-3">
          <FilePreview
            path={selected && paths.includes(selected) ? selected : null}
          />
        </div>
      </div>
    </Page>
  )
}
