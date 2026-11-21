import { Badge } from "@workspace/ui/components/badge"
import { Cloud, HardDrive, BookOpen } from "lucide-react"

export type Impact = "read" | "local" | "cloud"

type Props = {
  impact: Impact
  "data-testid"?: string
}

const LOOK: Record<
  Impact,
  {
    variant: "secondary" | "outline" | "default"
    label: string
    icon: typeof BookOpen
  }
> = {
  read: { variant: "secondary", label: "Read", icon: BookOpen },
  local: { variant: "outline", label: "Local", icon: HardDrive },
  cloud: { variant: "default", label: "Cloud", icon: Cloud },
}

/** Impact Badge: secondary Read, outline Local, default Cloud (DES-025). */
export function ImpactBadge({
  impact,
  "data-testid": testId = "impact-badge",
}: Props) {
  const look = LOOK[impact]
  const Icon = look.icon
  return (
    <Badge variant={look.variant} data-testid={testId}>
      <Icon />
      {look.label}
    </Badge>
  )
}
