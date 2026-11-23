import { useState } from "react"
import { useSearchParams } from "react-router"
import { Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Page, PageTitle } from "@/components/page"
import { mono } from "@/components/data/mono"
import { AddConnectorDialog } from "./AddConnectorDialog"
import { ConnectorSheet } from "./ConnectorSheet"
import { TransportBadge, StatusBadge, accessOf, authLabel } from "./connector-parts"
import { useConnectors } from "./connectors-store"
import { useStepUses } from "./connector-usage"
import { useLibrary } from "./library-store"

function UsedBy({ id, lib }: { id: string; lib: number }) {
  const n = useStepUses(id).length
  return (
    <TableCell className="text-muted-foreground">
      {n} {n === 1 ? "step" : "steps"}
      {lib > 0 ? ` · ${lib} in Library` : ""}
    </TableCell>
  )
}

export function ConnectorsPage() {
  const all = useConnectors()
  const items = useLibrary()
  const [params] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(params.get("connector"))
  const [adding, setAdding] = useState(false)
  const needs = all.filter((c) => c.status !== "connected").length

  return (
    <Page
      crumbs={[{ label: "Mockup", to: "/mock" }, { label: "Connectors" }]}
      actions={
        <Button onClick={() => setAdding(true)} data-testid="connector-add-open">
          <Plus />
          Add connector
        </Button>
      }
      data-testid="mock-connectors-page"
    >
      <PageTitle
        title="Connectors"
        description={`How agents and scripts reach outside systems. ${needs > 0 ? `${needs} need a sign-in. ` : ""}Mock data.`}
      />
      <Table data-testid="connector-table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Connects via</TableHead>
            <TableHead>Sign-in</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Used by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {all.map((c) => {
            const lib = c.providerId ? items.filter((i) => i.source === c.providerId).length : 0
            return (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)} data-testid={`connector-row-${c.id}`}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className={`${mono} max-w-64 truncate text-xs text-muted-foreground`}>{c.how}</span>
                  </div>
                </TableCell>
                <TableCell><TransportBadge transport={c.transport} /></TableCell>
                <TableCell className="text-muted-foreground">{authLabel(c.auth)}</TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell>
                  <Badge variant={accessOf(c) === "Read only" ? "outline" : "secondary"}>{accessOf(c)}</Badge>
                </TableCell>
                <UsedBy id={c.id} lib={lib} />
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <ConnectorSheet connector={all.find((c) => c.id === openId) ?? null} onClose={() => setOpenId(null)} />
      <AddConnectorDialog open={adding} onOpenChange={setAdding} onAdded={setOpenId} />
    </Page>
  )
}
