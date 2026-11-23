import { Cable, Terminal, Server } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import { AUTH, TRANSPORT, type Auth, type ConnStatus, type Connector, type Transport } from "./connectors-data"

const ICON = { mcp: Server, api: Cable, cli: Terminal }

export function TransportBadge({ transport }: { transport: Transport }) {
  const Icon = ICON[transport]
  return (
    <Badge variant="outline">
      <Icon />
      {TRANSPORT[transport].label}
    </Badge>
  )
}

const STATUS: Record<ConnStatus, { tone: Tone; label: string }> = {
  connected: { tone: "done", label: "Connected" },
  expired: { tone: "attention", label: "Sign-in expired" },
  off: { tone: "idle", label: "Not connected" },
}

export const StatusBadge = ({ status }: { status: ConnStatus }) => (
  <StatusPill tone={STATUS[status].tone}>{STATUS[status].label}</StatusPill>
)

/** The one action that fixes a connector, named for how it signs in. */
export const SIGN_IN: Record<Auth, string> = {
  cookies: "Sign in with browser",
  pat: "Enter token",
  oauth: "Authorize",
  "cli-login": "Check CLI login",
  none: "Check",
}

export const authLabel = (a: Auth) => AUTH[a].label

/** Read only unless an allowed capability writes. */
export const accessOf = (c: Connector) =>
  c.capabilities.some((x) => x.write && x.allowed) ? "Read and write" : "Read only"
