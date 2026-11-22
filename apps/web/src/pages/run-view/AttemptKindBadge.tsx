import type { AttemptKindInfo } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Hand, Play, RotateCcw, Unplug } from "lucide-react"

type Props = {
  kind: AttemptKindInfo
  attempt: number
}

function variantFor(kind: AttemptKindInfo["kind"]) {
  switch (kind) {
    case "retry":
      return "destructive" as const
    default:
      return "outline" as const
  }
}

function Icon({ kind }: { kind: AttemptKindInfo["kind"] }) {
  switch (kind) {
    case "run":
      return <Play />
    case "retry":
      return <RotateCcw />
    case "manual_retry":
      return <Hand />
    case "interrupted":
      return <Unplug />
  }
}

export function AttemptKindBadge({ kind, attempt }: Props) {
  return (
    <Badge
      variant={variantFor(kind.kind)}
      data-testid={`attempt-kind-${attempt}`}
      aria-label={kind.ariaLabel}
    >
      <Icon kind={kind.kind} />
      {kind.label}
    </Badge>
  )
}
