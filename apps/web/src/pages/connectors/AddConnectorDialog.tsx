import { useState } from "react"
import type { ConnectorAuth, ConnectorTransport } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { AUTH, AUTH_FOR, TRANSPORT } from "./connector-labels"
import { saveConnector, slugFromName } from "./connector-actions"

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdded: (id: string) => void
  onConflict: () => void
  onError: (message: string) => void
}

export function AddConnectorDialog({
  open,
  onOpenChange,
  onAdded,
  onConflict,
  onError,
}: Props) {
  const client = useFlowsClient()
  const [transport, setTransport] = useState<ConnectorTransport>("api")
  const [auth, setAuth] = useState<ConnectorAuth>("cookies")
  const [name, setName] = useState("")
  const [how, setHow] = useState("")
  const [busy, setBusy] = useState(false)
  const t = TRANSPORT[transport]
  const authItems = AUTH_FOR[transport].map((a) => ({
    value: a,
    label: AUTH[a].label,
  }))

  function pick(next: ConnectorTransport) {
    setTransport(next)
    setAuth(AUTH_FOR[next][0])
  }

  function close(o: boolean) {
    if (!o) {
      setName("")
      setHow("")
      setBusy(false)
    }
    onOpenChange(o)
  }

  async function onSubmit() {
    const trimmed = name.trim()
    const howTrimmed = how.trim()
    if (!trimmed || !howTrimmed) return
    const id = slugFromName(trimmed, `connector-${Date.now()}`)
    setBusy(true)
    const result = await saveConnector(client, {
      id,
      name: trimmed,
      transport,
      how: howTrimmed,
      auth,
      capabilities: [
        {
          name: "read",
          desc: "Read data (discovered on first connect)",
          write: false,
          allowed: true,
        },
      ],
    })
    setBusy(false)
    if (!result.ok) {
      if (result.kind === "conflict") onConflict()
      else onError(result.message)
      return
    }
    onAdded(id)
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-testid="connector-add">
        <DialogHeader>
          <DialogTitle>Add connector</DialogTitle>
          <DialogDescription>
            Pick how it connects, then how it signs in.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Connects via</FieldLabel>
          <ToggleGroup
            value={[transport]}
            onValueChange={(v) => v[0] && pick(v[0] as ConnectorTransport)}
            variant="outline"
          >
            {(Object.keys(TRANSPORT) as ConnectorTransport[]).map((k) => (
              <ToggleGroupItem
                key={k}
                value={k}
                data-testid={`connector-transport-${k}`}
              >
                {TRANSPORT[k].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{t.hint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-name">Name</FieldLabel>
          <Input
            id="cn-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wiki"
            data-testid="connector-add-name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-how">{t.field}</FieldLabel>
          <Input
            id="cn-how"
            value={how}
            onChange={(e) => setHow(e.target.value)}
            placeholder={t.example}
            data-testid="connector-add-how"
          />
        </Field>
        <Field>
          <FieldLabel>Sign-in</FieldLabel>
          <Select
            value={auth}
            items={authItems}
            onValueChange={(v) => v && setAuth(v as ConnectorAuth)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {authItems.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{AUTH[auth].hint}.</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim() || !how.trim()}
            data-testid="connector-add-submit"
            onClick={() => void onSubmit()}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
