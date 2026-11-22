import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import {
  connectionsListSchema,
  connectionCheckResultSchema,
  type ConnectionCheckResult,
  type ConnectionListItem,
} from "@workspace/shared"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageSection } from "@/components/page"
import { api } from "@/lib/api"
import { connectionPath } from "@/lib/paths"
import { AddConnectionDialog } from "./AddConnectionDialog"

type Props = {
  addOpen: boolean
  onAddOpenChange: (open: boolean) => void
}

export function ConnectionsListTab({ addOpen, onAddOpenChange }: Props) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ConnectionListItem[] | null>(null)
  const [checks, setChecks] = useState<Record<string, ConnectionCheckResult>>(
    {}
  )
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.connections.$get()
      if (!res.ok) throw new Error("failed")
      const body = connectionsListSchema.parse(await res.json())
      setRows(body.connections)
      const next: Record<string, ConnectionCheckResult> = {}
      await Promise.all(
        body.connections.map(async (conn) => {
          const checkRes = await api.connections[":id"].check.$post({
            param: { id: conn.id },
          })
          if (!checkRes.ok) return
          next[conn.id] = connectionCheckResultSchema.parse(
            await checkRes.json()
          )
        })
      )
      setChecks(next)
    } catch {
      setError("Could not load connections.")
      setRows([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <PageSection title="How it works">
        <ol
          className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground"
          data-testid="connections-explainer"
        >
          <li>Connect an outside system and sign in on this machine.</li>
          <li>Pull data into the Library so tasks can read it.</li>
          <li>
            Publish only when you place a publish task; policy gates what
            leaves.
          </li>
        </ol>
      </PageSection>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : rows === null ? (
        <div className="space-y-3" data-testid="connections-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Empty data-testid="connections-empty">
          <EmptyHeader>
            <EmptyTitle>No connections yet</EmptyTitle>
            <EmptyDescription>
              Add a connection to pull data into the Library.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table data-testid="connections-table">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Connector</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Refresh</TableHead>
              <TableHead>Used by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((conn) => {
              const check = checks[conn.id]
              return (
                <TableRow
                  key={conn.id}
                  className="cursor-pointer"
                  data-testid={`connections-row-${conn.id}`}
                  onClick={() => void navigate(connectionPath(conn.id))}
                >
                  <TableCell>
                    <Link
                      to={connectionPath(conn.id)}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {conn.name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {conn.id}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {conn.connector}
                  </TableCell>
                  <TableCell
                    className={
                      check && !check.ok
                        ? "text-sm text-destructive"
                        : "text-sm"
                    }
                    data-testid={`connection-signin-${conn.id}`}
                  >
                    {!check
                      ? "Checking…"
                      : check.ok
                        ? "Signed in"
                        : check.message}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {conn.refresh}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {conn.usedBy.length === 0 ? "—" : conn.usedBy.join(", ")}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <AddConnectionDialog
        open={addOpen}
        onOpenChange={onAddOpenChange}
        onCreated={(id) => {
          void load().then(() => navigate(connectionPath(id)))
        }}
      />
    </>
  )
}
