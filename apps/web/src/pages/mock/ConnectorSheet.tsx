import { useState } from "react"
import { Link } from "react-router"
import { Bot, Library } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { mono } from "@/components/data/mono"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SIGN_IN, StatusBadge, TransportBadge, authLabel } from "./connector-parts"
import { AUTH, TRANSPORT, type Connector } from "./connectors-data"
import { disconnect, markChecked, markConnected, removeConnector, setAllowed } from "./connectors-store"
import { useLibrary } from "./library-store"
import { useStepUses } from "./connector-usage"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

export function ConnectorSheet({ connector: c, onClose }: { connector: Connector | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const items = useLibrary()
  const uses = useStepUses(c?.id ?? "")
  const lib = c?.providerId ? items.filter((i) => i.source === c.providerId) : []

  function run(action: (id: string) => void) {
    if (!c) return
    setBusy(true)
    setTimeout(() => {
      action(c.id)
      setBusy(false)
    }, 900)
  }

  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg" data-testid="connector-sheet">
        {c ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="flex items-center gap-2">
                {c.name}
                <TransportBadge transport={c.transport} />
              </SheetTitle>
              <SheetDescription>{TRANSPORT[c.transport].hint}</SheetDescription>
            </SheetHeader>
            <div className="mx-4 flex flex-col gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-foreground/10">
              <div className="flex items-center gap-2">
                <StatusBadge status={c.status} />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {c.account ? `${c.account} · ` : ""}checked {c.checked}
                </span>
                <Button
                  variant={c.status === "connected" ? "outline" : "default"}
                  disabled={busy}
                  onClick={() => run(c.status === "connected" ? markChecked : markConnected)}
                  data-testid="connector-action"
                >
                  {busy ? <Spinner /> : null}
                  {busy ? "Working…" : c.status === "connected" ? "Test" : SIGN_IN[c.auth]}
                </Button>
              </div>
              {c.status === "expired" ? (
                <p className="text-xs text-muted-foreground">
                  Cookies expire on their own. Steps that use this connector wait for a sign-in instead of failing.
                </p>
              ) : null}
            </div>
            <Tabs defaultValue="access" className="min-h-0 flex-1 px-4 pt-1">
              <TabsList>
                <TabsTrigger value="access">Access ({c.capabilities.length})</TabsTrigger>
                <TabsTrigger value="used" data-testid="connector-tab-used">
                  Used by ({uses.length + (lib.length ? 1 : 0)})
                </TabsTrigger>
                <TabsTrigger value="setup">Setup</TabsTrigger>
              </TabsList>
              <TabsContent value="access" className="flex flex-col gap-1 overflow-y-auto py-3">
                <p className="pb-2 text-sm text-muted-foreground">
                  What agents and scripts may do here. Writing is off until you allow it.
                </p>
                {c.capabilities.map((x) => (
                  <div key={x.name} className="flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-muted" data-testid={`capability-${x.name}`}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={mono}>{x.name}</span>
                        {x.write ? <Badge variant="secondary">Writes</Badge> : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{x.desc}</span>
                    </div>
                    <Switch checked={x.allowed} onCheckedChange={(v) => setAllowed(c.id, x.name, v)} aria-label={`Allow ${x.name}`} />
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="used" className="flex flex-col gap-4 overflow-y-auto py-3">
                {uses.length === 0 && lib.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing uses this yet. Add it to an agent or script step in a workflow.</p>
                ) : null}
                {uses.map((u) => (
                  <Link
                    key={`${u.workflowId}-${u.node}`}
                    to={`/mock/workflows/${u.workflowId}`}
                    className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted"
                  >
                    <Bot className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{u.step}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{u.workflow}</span>
                  </Link>
                ))}
                {lib.length > 0 ? (
                  <Link to="/mock/library" className="-mx-2 flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                    <Library className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">Library fetches</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{lib.length} linked {lib.length === 1 ? "item" : "items"}</span>
                  </Link>
                ) : null}
              </TabsContent>
              <TabsContent value="setup" className="flex flex-col gap-3 overflow-y-auto py-3">
                <div>
                  <Row label={TRANSPORT[c.transport].field} value={<span className={mono}>{c.how}</span>} />
                  <Row label="Sign-in" value={authLabel(c.auth)} />
                </div>
                <p className="text-xs text-muted-foreground">{AUTH[c.auth].hint}.</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={c.status === "off"} onClick={() => disconnect(c.id)}>Disconnect</Button>
                  <Button variant="outline" onClick={() => setRemoving(true)}>Remove</Button>
                </div>
              </TabsContent>
            </Tabs>
            <ConfirmDialog
              open={removing}
              onOpenChange={setRemoving}
              title="Remove connector?"
              description="Steps and Library items that use it will wait for a connector. Saved sign-ins on this machine are deleted."
              confirmLabel="Remove"
              onConfirm={() => {
                removeConnector(c.id)
                setRemoving(false)
                onClose()
              }}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
