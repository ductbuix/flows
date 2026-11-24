import { useState } from "react"
import type { ConnectorFile } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { mono } from "@/components/data/mono"
import { TRANSPORT, authLabel } from "./connector-labels"
import { removeConnector } from "./connector-actions"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

export function ConnectorAccessTab({
  capabilities,
  busy,
  onToggle,
}: {
  capabilities: ConnectorFile["capabilities"]
  busy: boolean
  onToggle: (name: string, allowed: boolean) => void
}) {
  return (
    <>
      <p className="pb-2 text-sm text-muted-foreground">
        What agents and scripts may do here. Writing is off until you allow it.
      </p>
      {capabilities.map((x) => (
        <div
          key={x.name}
          className="flex min-h-12 items-center gap-3 rounded-lg px-2 hover:bg-muted"
          data-testid={`capability-${x.name}`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2 text-sm">
              <span className={mono}>{x.name}</span>
              {x.write ? <Badge variant="secondary">Writes</Badge> : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {x.desc}
            </span>
          </div>
          <Switch
            checked={x.allowed}
            disabled={busy}
            onCheckedChange={(v) => onToggle(x.name, v)}
            aria-label={`Allow ${x.name}`}
          />
        </div>
      ))}
    </>
  )
}

export function ConnectorSetupTab({
  connector: c,
  authHint,
  busy,
  onRemoved,
  onConflict,
  onError,
}: {
  connector: ConnectorFile
  authHint: string
  busy: boolean
  onRemoved: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const [removing, setRemoving] = useState(false)
  const [working, setWorking] = useState(false)

  async function onRemove() {
    setWorking(true)
    const result = await removeConnector(client, c.id)
    setWorking(false)
    if (!result.ok) {
      if (result.kind === "conflict") onConflict()
      else onError(result.message)
      return
    }
    setRemoving(false)
    onRemoved()
  }

  return (
    <>
      <div>
        <Row
          label={TRANSPORT[c.transport].field}
          value={<span className={mono}>{c.how}</span>}
        />
        <Row label="Sign-in" value={authLabel(c.auth)} />
      </div>
      <p className="text-xs text-muted-foreground">{authHint}.</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy || working}
          onClick={() => setRemoving(true)}
          data-testid="connector-remove"
        >
          Remove
        </Button>
      </div>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove connector?"
        description="Steps and Library items that use it will wait for a connector. Saved sign-ins on this machine are deleted."
        confirmLabel="Remove"
        onConfirm={() => void onRemove()}
      />
    </>
  )
}
