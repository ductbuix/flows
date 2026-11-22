import { useEffect, useState } from "react"
import {
  connectionIdSchema,
  connectorsListSchema,
  connectionSchema,
  type ConnectorDescribe,
  type RefreshRule,
  type SignInMethod,
} from "@workspace/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"
import { AddConnectionFields } from "./AddConnectionFields"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function AddConnectionDialog({ open, onOpenChange, onCreated }: Props) {
  const [connectors, setConnectors] = useState<ConnectorDescribe[] | null>(null)
  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [connectorId, setConnectorId] = useState("")
  const [signIn, setSignIn] = useState<SignInMethod>("cli")
  const [refresh, setRefresh] = useState<RefreshRule>("15m")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const res = await api.connectors.$get()
        if (!res.ok) throw new Error("failed")
        const body = connectorsListSchema.parse(await res.json())
        if (cancelled) return
        setConnectors(body.connectors)
        const first = body.connectors[0]
        if (first) {
          setConnectorId((prev) => prev || first.id)
          setSignIn((prev) =>
            prev === "cli" ? (first.signInMethods[0] ?? prev) : prev
          )
        }
      } catch {
        if (!cancelled) setError("Could not load connectors.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  async function submit() {
    setError(null)
    const parsedId = connectionIdSchema.safeParse(id.trim())
    if (!parsedId.success) {
      setError("Id must be lowercase letters, digits and dashes.")
      return
    }
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!connectorId) {
      setError("Pick a connector.")
      return
    }
    const body = connectionSchema.safeParse({
      id: parsedId.data,
      connector: connectorId,
      name: name.trim(),
      scope: {},
      signIn,
      refresh,
      policy: "read-only",
      serial: false,
    })
    if (!body.success) {
      setError("Could not validate connection.")
      return
    }
    setBusy(true)
    try {
      const res = await api.connections.$post({ json: body.data })
      if (res.status === 409) {
        setError("A connection with that id already exists.")
        return
      }
      if (!res.ok) {
        setError("Could not create connection.")
        return
      }
      onCreated(parsedId.data)
      setId("")
      setName("")
      onOpenChange(false)
    } catch {
      setError("Could not create connection.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="connection-create">
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>
            Connect an outside system. Sign-in stays on this machine; tasks only
            see pulled data.
          </DialogDescription>
        </DialogHeader>
        <AddConnectionFields
          id={id}
          name={name}
          connectorId={connectorId}
          signIn={signIn}
          refresh={refresh}
          connectors={connectors}
          onId={setId}
          onName={setName}
          onConnector={setConnectorId}
          onSignIn={setSignIn}
          onRefresh={setRefresh}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="connection-create-submit"
            disabled={busy || !connectors?.length}
            onClick={() => void submit()}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
