import { useState } from "react"
import type { ConnectorFile, ConnectorStatus } from "@workspace/contracts"
import { useFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
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
import { AUTH, TRANSPORT } from "./connector-labels"
import {
  checkConnector,
  setCapability,
  signInConnector,
} from "./connector-actions"
import { ConnectorAccessTab } from "./ConnectorSheetTabs"
import { ConnectorSetupTab } from "./ConnectorSetupTab"
import { ConnectorStatusCard } from "./ConnectorStatusCard"
import { ConnectorUsedByTab } from "./ConnectorUsedByTab"
import { TransportBadge } from "./connector-parts"

export function ConnectorSheetBody({
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
  const libQ = useQuery("library/list", {}, { topics: ["library"] })
  const [patch, setPatch] = useState<{
    hash: string
    connector: ConnectorFile
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const remote = detailQ.data
  const c = patch?.connector ?? remote?.connector ?? null
  const hash = patch?.hash ?? remote?.hash ?? ""
  const status: ConnectorStatus = remote?.status ?? "off"
  const checkedAt = remote?.checkedAt
  const libCount =
    c?.providerId && libQ.data
      ? libQ.data.items.filter((i) => i.source === c.providerId).length
      : 0

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
      connector: {
        ...c,
        capabilities: c.capabilities.map((x) =>
          x.name === name ? { ...x, allowed } : x
        ),
      },
    })
  }

  async function onPrimaryAction() {
    if (!c) return
    setBusy(true)
    if (c.auth === "cookies" && status !== "connected") {
      const result = await signInConnector(client, id)
      setBusy(false)
      if (!result.ok) onError(result.message)
      return
    }
    const result = await checkConnector(client, id)
    setBusy(false)
    if (!result.ok) onError(result.message)
  }

  if (detailQ.loading && !c) {
    return (
      <div
        className="flex flex-col gap-2 px-4 pt-4"
        data-testid="connector-sheet-loading"
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (detailQ.error && !c) {
    return (
      <Alert
        variant="destructive"
        className="mx-4 mt-4"
        data-testid="connector-sheet-error"
      >
        <AlertTitle>Could not load connector</AlertTitle>
        <AlertDescription>{errorMessage(detailQ.error)}</AlertDescription>
      </Alert>
    )
  }

  if (!c) return null

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="flex items-center gap-2">
          {c.name}
          <TransportBadge transport={c.transport} />
        </SheetTitle>
        <SheetDescription>{TRANSPORT[c.transport].hint}</SheetDescription>
      </SheetHeader>
      <ConnectorStatusCard
        status={status}
        auth={c.auth}
        checkedAt={checkedAt}
        busy={busy}
        onAction={() => void onPrimaryAction()}
      />
      <Tabs defaultValue="access" className="min-h-0 flex-1 px-4 pt-1">
        <TabsList>
          <TabsTrigger value="access">
            Access ({c.capabilities.length})
          </TabsTrigger>
          <TabsTrigger value="used" data-testid="connector-tab-used">
            Used by ({libCount})
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
          value="used"
          className="flex flex-col gap-4 overflow-y-auto py-3"
        >
          <ConnectorUsedByTab providerId={c.providerId} />
        </TabsContent>
        <TabsContent
          value="setup"
          className="flex flex-col gap-3 overflow-y-auto py-3"
        >
          <ConnectorSetupTab
            key={`${c.id}:${hash}`}
            connector={c}
            hash={hash}
            status={status}
            authHint={AUTH[c.auth].hint}
            busy={busy}
            onSaved={(nextHash, next) =>
              setPatch({ hash: nextHash, connector: next })
            }
            onRemoved={onRemoved}
            onDisconnected={() => {
              /* status arrives via connector/update refetch */
            }}
            onConflict={onConflict}
            onError={onError}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
