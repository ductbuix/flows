import { useState } from "react"
import type { ConnectorFile, ConnectorStatus } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { TRANSPORT, authLabel } from "./connector-labels"
import {
  removeConnector,
  saveConnector,
  signOutConnector,
} from "./connector-actions"

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  )
}

export function ConnectorSetupTab({
  connector: c,
  hash,
  status,
  authHint,
  busy,
  onSaved,
  onRemoved,
  onDisconnected,
  onConflict,
  onError,
}: {
  connector: ConnectorFile
  hash: string
  status: ConnectorStatus
  authHint: string
  busy: boolean
  onSaved: (hash: string, connector: ConnectorFile) => void
  onRemoved: () => void
  onDisconnected: () => void
  onConflict: () => void
  onError: (message: string) => void
}) {
  const client = useFlowsClient()
  const [removing, setRemoving] = useState(false)
  const [working, setWorking] = useState(false)
  const [name, setName] = useState(c.name)
  const [how, setHow] = useState(c.how)
  const dirty = name.trim() !== c.name || how.trim() !== c.how

  async function onSave() {
    const trimmedName = name.trim()
    const trimmedHow = how.trim()
    if (!trimmedName || !trimmedHow || !hash) return
    setWorking(true)
    const next = { ...c, name: trimmedName, how: trimmedHow }
    const result = await saveConnector(client, next, hash)
    setWorking(false)
    if (!result.ok) {
      if (result.kind === "conflict") onConflict()
      else onError(result.message)
      return
    }
    onSaved(result.hash ?? hash, next)
  }

  async function onDisconnect() {
    setWorking(true)
    const result = await signOutConnector(client, c.id)
    setWorking(false)
    if (!result.ok) {
      if (result.kind === "conflict") onConflict()
      else onError(result.message)
      return
    }
    onDisconnected()
  }

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
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`cn-edit-name-${c.id}`}>Name</FieldLabel>
          <Input
            id={`cn-edit-name-${c.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || working}
            data-testid="connector-edit-name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`cn-edit-how-${c.id}`}>
            {TRANSPORT[c.transport].field}
          </FieldLabel>
          <Input
            id={`cn-edit-how-${c.id}`}
            value={how}
            onChange={(e) => setHow(e.target.value)}
            disabled={busy || working}
            data-testid="connector-edit-how"
          />
        </Field>
        <Row label="Sign-in" value={authLabel(c.auth)} />
      </div>
      <p className="text-xs text-muted-foreground">{authHint}.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          disabled={busy || working || !dirty || !name.trim() || !how.trim()}
          onClick={() => void onSave()}
          data-testid="connector-save"
        >
          Save
        </Button>
        <Button
          variant="outline"
          disabled={busy || working || status === "off"}
          onClick={() => void onDisconnect()}
          data-testid="connector-disconnect"
        >
          Disconnect
        </Button>
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
