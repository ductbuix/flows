import { useState } from "react"
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
import {
  AUTH,
  AUTH_FOR,
  TRANSPORT,
  type Auth,
  type Transport,
} from "./connectors-data"
import { addConnector } from "./connectors-store"

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdded: (id: string) => void
}

/** Two choices: how it connects, then how it signs in (only the sign-ins that fit). */
export function AddConnectorDialog({ open, onOpenChange, onAdded }: Props) {
  const [transport, setTransport] = useState<Transport>("api")
  const [auth, setAuth] = useState<Auth>("cookies")
  const [name, setName] = useState("")
  const [how, setHow] = useState("")
  const t = TRANSPORT[transport]
  const authItems = AUTH_FOR[transport].map((a) => ({
    value: a,
    label: AUTH[a].label,
  }))

  function pick(next: Transport) {
    setTransport(next)
    setAuth(AUTH_FOR[next][0])
  }
  function close(o: boolean) {
    if (!o) {
      setName("")
      setHow("")
    }
    onOpenChange(o)
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
            onValueChange={(v) => v[0] && pick(v[0] as Transport)}
            variant="outline"
          >
            {(Object.keys(TRANSPORT) as Transport[]).map((k) => (
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
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cn-how">{t.field}</FieldLabel>
          <Input
            id="cn-how"
            value={how}
            onChange={(e) => setHow(e.target.value)}
            placeholder={t.example}
          />
        </Field>
        <Field>
          <FieldLabel>Sign-in</FieldLabel>
          <Select
            value={auth}
            items={authItems}
            onValueChange={(v) => v && setAuth(v as Auth)}
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
            disabled={!name.trim() || !how.trim()}
            data-testid="connector-add-submit"
            onClick={() => {
              onAdded(addConnector(name.trim(), transport, how.trim(), auth))
              close(false)
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
