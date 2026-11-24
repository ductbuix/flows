import { useState } from "react"
import { useSearchParams } from "react-router"
import { Plus } from "lucide-react"
import { useOptionalFlowsClient, useQuery } from "@workspace/sdk-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FlowsClientGate } from "@/components/FlowsClientGate"
import { Page, PageTitle } from "@/components/page"
import { AddConnectorDialog } from "./AddConnectorDialog"
import { ConnectorSheet } from "./ConnectorSheet"
import { ConnectorsTable } from "./ConnectorsTable"
import {
  ConnectorsEmpty,
  ConnectorsLoadError,
  ConnectorsLoading,
} from "./ConnectorsStates"

export function ConnectorsPage() {
  const existing = useOptionalFlowsClient()
  if (existing) return <ConnectorsPageGate />
  return (
    <FlowsClientGate>
      <ConnectorsPageGate />
    </FlowsClientGate>
  )
}

/** Remount inner after add/remove so list refetches (status uses connector/update). */
function ConnectorsPageGate() {
  const [epoch, setEpoch] = useState(0)
  const [params] = useSearchParams()
  const [pendingOpen, setPendingOpen] = useState<string | null>(
    params.get("connector")
  )

  return (
    <ConnectorsPageInner
      key={epoch}
      initialOpenId={pendingOpen}
      onMutated={(openId) => {
        setPendingOpen(openId)
        setEpoch((e) => e + 1)
      }}
    />
  )
}

function ConnectorsPageInner({
  initialOpenId,
  onMutated,
}: {
  initialOpenId: string | null
  onMutated: (openId: string | null) => void
}) {
  const listQ = useQuery("connector/list", {}, { topics: ["connector"] })
  const [openId, setOpenId] = useState<string | null>(initialOpenId)
  const [adding, setAdding] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const items = listQ.data?.items ?? []
  const loading = listQ.loading && !listQ.data

  if (loading) return <ConnectorsLoading />
  if (listQ.error && !listQ.data) {
    return <ConnectorsLoadError error={listQ.error} />
  }

  return (
    <Page
      crumbs={[{ label: "Connectors" }]}
      actions={
        <Button
          onClick={() => setAdding(true)}
          data-testid="connector-add-open"
        >
          <Plus />
          Add connector
        </Button>
      }
      data-testid="connectors-page"
    >
      <PageTitle
        title="Connectors"
        description="How agents and scripts reach outside systems."
      />
      {(conflict || actionError) && (
        <Alert variant="destructive" data-testid="connectors-conflict">
          <AlertTitle>{conflict ? "Conflict" : "Could not update"}</AlertTitle>
          <AlertDescription>
            {conflict
              ? "This connector changed on disk. Close the sheet and try again."
              : actionError}
          </AlertDescription>
        </Alert>
      )}
      {items.length === 0 ? (
        <ConnectorsEmpty />
      ) : (
        <ConnectorsTable
          items={items}
          onPick={(id) => {
            setConflict(false)
            setActionError(null)
            setOpenId(id)
          }}
        />
      )}
      <ConnectorSheet
        openId={openId}
        onClose={() => setOpenId(null)}
        onRemoved={() => onMutated(null)}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
      <AddConnectorDialog
        open={adding}
        onOpenChange={setAdding}
        onAdded={(id) => onMutated(id)}
        onConflict={() => setConflict(true)}
        onError={(message) => {
          setConflict(false)
          setActionError(message)
        }}
      />
    </Page>
  )
}
