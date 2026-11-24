import { useState } from "react"
import type { ConnectorFile } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { errorMessage } from "@/lib/fcp-error"
import { AUTH, TRANSPORT, authLabel } from "./connector-labels"
import { setCapability } from "./connector-actions"
import { ConnectorAccessTab, ConnectorSetupTab } from "./ConnectorSheetTabs"
import { TransportBadge, accessOf } from "./connector-parts"

export function ConnectorSheet({
  openId,
  onClose,
  onRemoved,
  onConflict,
  onError,
}: {
  openId: string | null
  onClose: () => void
  onRemoved: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  return (
    <Sheet open={!!openId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="connector-sheet"
      >
        {openId ? (
          <ConnectorSheetBody
            id={openId}
            onRemoved={onRemoved}
            onConflict={onConflict}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ConnectorSheetBody({
  id,
  onRemoved,
  onConflict,
  onError,
}: {
  id: string
  onRemoved: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const detailQ = useQuery("connector/get", { id }, { topics: ["connector"] })
  const [patch, setPatch] = useState<{
    hash: string
    capabilities: ConnectorFile["capabilities"]
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const remote = detailQ.data
  const c = remote
    ? {
        ...remote.connector,
        ...(patch ? { capabilities: patch.capabilities } : {}),
      }
    : null
  const hash = patch?.hash ?? remote?.hash ?? ""

  async function onToggle(name: string, allowed: boolean) {
    if (!c || !hash) return
    setBusy(true)
    const result = await setCapability(client, {
      id,
      name,
      allowed,
      baseHash: hash,
    })
    setBusy(false)
    if (!result.ok) {
      if (result.kind === "conflict") onConflict()
      else onError(result.message)
      return
    }
    setPatch({
      hash: result.hash ?? hash,
      capabilities: c.capabilities.map((x) =>
        x.name === name ? { ...x, allowed } : x
      ),
    })
  }

  return (
    <>
      {detailQ.loading && !c ? (
        <div
          className="flex flex-col gap-2 px-4 pt-4"
          data-testid="connector-sheet-loading"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {detailQ.error && !c ? (
        <Alert
          variant="destructive"
          className="mx-4 mt-4"
          data-testid="connector-sheet-error"
        >
          <AlertTitle>Could not load connector</AlertTitle>
          <AlertDescription>{errorMessage(detailQ.error)}</AlertDescription>
        </Alert>
      ) : null}
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
              <Badge variant="secondary">{accessOf(c)}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {authLabel(c.auth)}
              </span>
            </div>
          </div>
          <Tabs defaultValue="access" className="min-h-0 flex-1 px-4 pt-1">
            <TabsList>
              <TabsTrigger value="access">
                Access ({c.capabilities.length})
              </TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
            </TabsList>
            <TabsContent
              value="access"
              className="flex flex-col gap-1 overflow-y-auto py-3"
            >
              <ConnectorAccessTab
                capabilities={c.capabilities}
                busy={busy}
                onToggle={onToggle}
              />
            </TabsContent>
            <TabsContent
              value="setup"
              className="flex flex-col gap-3 overflow-y-auto py-3"
            >
              <ConnectorSetupTab
                connector={c}
                authHint={AUTH[c.auth].hint}
                busy={busy}
                onRemoved={onRemoved}
                onConflict={onConflict}
                onError={onError}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </>
  )
}
