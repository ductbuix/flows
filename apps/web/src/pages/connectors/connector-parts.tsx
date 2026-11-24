import { Cable, Terminal, Server } from "lucide-react"
import type { ConnectorFile, ConnectorTransport } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
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

/** Read only unless an allowed capability writes. */
export const accessOf = (c: Pick<ConnectorFile, "capabilities">) =>
  c.capabilities.some((x) => x.write && x.allowed)
    ? "Read and write"
    : "Read only"
