import type {
  ConnectorDescribe,
  RefreshRule,
  SignInMethod,
} from "@workspace/shared"
import { refreshRuleSchema, signInMethodSchema } from "@workspace/shared"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

const REFRESH: RefreshRule[] = ["15m", "1h", "1d", "never"]

type Props = {
  id: string
  name: string
  connectorId: string
  signIn: SignInMethod
  refresh: RefreshRule
  connectors: ConnectorDescribe[] | null
  onId: (value: string) => void
  onName: (value: string) => void
  onConnector: (value: string) => void
  onSignIn: (value: SignInMethod) => void
  onRefresh: (value: RefreshRule) => void
}

export function AddConnectionFields({
  id,
  name,
  connectorId,
  signIn,
  refresh,
  connectors,
  onId,
  onName,
  onConnector,
  onSignIn,
  onRefresh,
}: Props) {
  const selected = connectors?.find((c) => c.id === connectorId)
  return (
    <>
      <Field>
        <FieldLabel htmlFor="conn-id">Id</FieldLabel>
        <Input
          id="conn-id"
          data-testid="connection-create-id"
          value={id}
          onChange={(e) => onId(e.target.value)}
          placeholder="github-acme"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="conn-name">Name</FieldLabel>
        <Input
          id="conn-name"
          data-testid="connection-create-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Acme GitHub"
        />
      </Field>
      <Field>
        <FieldLabel>Connector</FieldLabel>
        <Select
          value={connectorId}
          onValueChange={(value) => {
            if (!value) return
            onConnector(value)
            const next = connectors?.find((c) => c.id === value)
            if (next) onSignIn(next.signInMethods[0] ?? "cli")
          }}
        >
          <SelectTrigger data-testid="connection-create-connector">
            <SelectValue placeholder="Pick a connector" />
          </SelectTrigger>
          <SelectContent>
            {(connectors ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Sign-in</FieldLabel>
        <Select
          value={signIn}
          onValueChange={(value) => {
            const parsed = signInMethodSchema.safeParse(value)
            if (parsed.success) onSignIn(parsed.data)
          }}
        >
          <SelectTrigger data-testid="connection-create-signin">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(selected?.signInMethods ?? signInMethodSchema.options).map(
              (method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Refresh</FieldLabel>
        <Select
          value={refresh}
          onValueChange={(value) => {
            const parsed = refreshRuleSchema.safeParse(value)
            if (parsed.success) onRefresh(parsed.data)
          }}
        >
          <SelectTrigger data-testid="connection-create-refresh">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REFRESH.map((rule) => (
              <SelectItem key={rule} value={rule}>
                {rule}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}
