import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Cable } from "lucide-react"
import { libraryListSchema, type LibraryList } from "@workspace/shared"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { LibraryUsageAlert } from "@/components/LibraryUsageAlert"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { api } from "@/lib/api"
import {
  connectionsPath,
  parseConnectionsTab,
  type ConnectionsTab,
} from "@/lib/paths"

/** Connections + Library tabs (DES-025). Library size warning is BL-047. */
export function ConnectionsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tab: ConnectionsTab =
    parseConnectionsTab(params.get("tab")) ?? "connections"
  const [library, setLibrary] = useState<LibraryList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (tab !== "library") return
    let alive = true
    void (async () => {
      try {
        const res = await api.library.$get()
        if (!res.ok) throw new Error("library list failed")
        const body = libraryListSchema.parse(await res.json())
        if (alive) {
          setLibrary(body)
          setError(null)
        }
      } catch {
        if (alive) setError("Could not load library")
      }
    })()
    return () => {
      alive = false
    }
  }, [tab])

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="connections-page"
    >
      <PageHeader crumbs={[{ label: "Connections" }]} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
        <PageTitle title="Connections" />
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === "connections" || value === "library") {
              void navigate(connectionsPath(value))
            }
          }}
          className="gap-4"
        >
          <TabsList variant="line" data-testid="connections-tabs">
            <TabsTrigger
              value="connections"
              data-testid="connections-tab-connections"
            >
              Connections
            </TabsTrigger>
            <TabsTrigger value="library" data-testid="connections-tab-library">
              Library
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "connections" ? (
          <Empty data-testid="connections-placeholder">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cable />
              </EmptyMedia>
              <EmptyTitle>No connections yet</EmptyTitle>
              <EmptyDescription>
                Add a connection to pull outside data into the library.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {tab === "library" ? (
          <div className="flex flex-col gap-4" data-testid="library-tab">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!library && !error ? (
              <Skeleton className="h-16 w-full" data-testid="library-loading" />
            ) : null}
            {library ? (
              <>
                <LibraryUsageAlert usage={library.usage} />
                {library.entities.length === 0 ? (
                  <Empty data-testid="library-empty">
                    <EmptyHeader>
                      <EmptyTitle>Library is empty</EmptyTitle>
                      <EmptyDescription>
                        Pull from a connection to store entity revisions here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className="space-y-2" data-testid="library-entity-list">
                    {library.entities.map((ent) => (
                      <li
                        key={`${ent.connection}/${ent.kind}/${ent.entityId}`}
                        className="text-sm"
                        data-testid={`library-entity-${ent.connection}`}
                      >
                        <span className="font-medium">{ent.title}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {ent.connection}/{ent.kind}/{ent.entityId} ·{" "}
                          {ent.revisions.length} revision
                          {ent.revisions.length === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
