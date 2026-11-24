import { Cable, Terminal, Server } from "lucide-react"
import type {
  ConnectorAuth,
  ConnectorFile,
  ConnectorStatus,
  ConnectorTransport,
} from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import { TRANSPORT } from "./connector-labels"

const ICON = { mcp: Server, api: Cable, cli: Terminal }

export function TransportBadge({
  transport,
}: {
  transport: ConnectorTransport
}) {
  const Icon = ICON[transport]
  return (
    <Badge variant="outline">
      <Icon />
      {TRANSPORT[transport].label}
    </Badge>
  )
}

const STATUS: Record<ConnectorStatus, { tone: Tone; label: string }> = {
  connected: { tone: "done", label: "Connected" },
  expired: { tone: "attention", label: "Sign-in expired" },
  off: { tone: "idle", label: "Not connected" },
}

export function StatusBadge({ status }: { status: ConnectorStatus }) {
  return (
    <StatusPill tone={STATUS[status].tone} data-testid="connector-status">
      {STATUS[status].label}
    </StatusPill>
  )
}

/** The one action that fixes a connector, named for how it signs in. */
export const SIGN_IN: Record<ConnectorAuth, string> = {
  cookies: "Sign in with browser",
  pat: "Enter token",
  oauth: "Authorize",
  "cli-login": "Check CLI login",
  none: "Check",
}

/** Read only unless an allowed capability writes. */
export const accessOf = (c: Pick<ConnectorFile, "capabilities">) =>
  c.capabilities.some((x) => x.write && x.allowed)
    ? "Read and write"
    : "Read only"
