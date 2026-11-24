import { useEffect, useMemo, useState } from "react"
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react"
import { useFlowsClient } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"
import { FilesTree, folderPaths } from "@/pages/mock/FilesTree"
import { FilePreview } from "./FilePreview"
import { listAllFilePaths } from "./list-files"

const HOME_LABEL = ".flowapp"

export function FilesPage() {
  return (
    <FlowsClientGate>
      <FilesPageInner />
    </FlowsClientGate>
  )
}

function FilesPageInner() {
  const client = useFlowsClient()
  const [allPaths, setAllPaths] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    void listAllFilePaths(client)
      .then((paths) => {
        if (alive) setAllPaths(paths)
      })
      .catch((err) => {
        if (alive) setLoadError(errorMessage(err))
      })
    return () => {
      alive = false
    }
  }, [client])

  const q = query.trim().toLowerCase()
  const paths = useMemo(() => {
    if (!allPaths) return []
    return allPaths.filter((p) => p.toLowerCase().includes(q))
  }, [allPaths, q])
  const roots = useMemo(() => pathsToFileTree(paths), [paths])
  const folders = useMemo(() => folderPaths(roots), [roots])
  const shown = q ? new Set(folders) : open
  const allOpen = folders.length > 0 && folders.every((f) => shown.has(f))

  if (loadError) {
    return (
      <Page
        fill
        crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Files" }]}
        data-testid="mock-files-page"
      >
        <PageTitle
          title="Files"
          description="Could not list workspace files."
        />
        <Alert variant="destructive" data-testid="files-error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </Page>
    )
  }

  if (allPaths === null) {
    return (
      <Page
        fill
        crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Files" }]}
        data-testid="mock-files-page"
      >
        <PageTitle title="Files" description="Loading workspace files…" />
        <div className="flex flex-col gap-3" data-testid="files-loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </Page>
    )
  }

  return (
    <Page
      fill
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Files" }]}
      data-testid="mock-files-page"
    >
      <PageTitle
        title="Files"
        description={`Workspace files under ~/${HOME_LABEL}.`}
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
              <Empty data-testid="files-search-empty">
                <EmptyHeader>
                  <EmptyTitle>
                    {allPaths.length === 0 ? "No files" : "No matching files"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {allPaths.length === 0
                      ? "The workspace has no files yet."
                      : "Try a different search."}
                  </EmptyDescription>
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
            homeLabel={HOME_LABEL}
          />
        </div>
      </div>
    </Page>
  )
}
