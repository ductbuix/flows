import { useEffect, useState } from "react"
import { Link } from "react-router"
import { connectionsListSchema, type Connection } from "@workspace/shared"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { PageTitle } from "@/components/PageTitle"
import { api } from "@/lib/api"

/** Minimal connections list; full UI is BL-045. */
export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await api.connections.$get()
        if (!res.ok) throw new Error("list failed")
        const body = connectionsListSchema.parse(await res.json())
        if (alive) setConnections(body.connections)
      } catch {
        if (alive) setError("Could not load connections")
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Connections" }]} />
      <div
        className="flex flex-1 flex-col gap-6 overflow-auto p-4"
        data-testid="connections-page"
      >
        <PageTitle
          title="Connections"
          description="Outside systems Flows can pull from and publish to."
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : connections === null ? (
          <Skeleton className="h-24 w-full max-w-xl" />
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connections yet.</p>
        ) : (
          <ItemGroup className="max-w-xl">
            {connections.map((conn) => (
              <Item
                key={conn.id}
                render={<Link to={`/connections/${conn.id}`} />}
                data-testid={`connection-row-${conn.id}`}
              >
                <ItemContent>
                  <ItemTitle>{conn.name}</ItemTitle>
                  <ItemDescription>
                    {conn.connector} · {conn.signIn}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  )
}
