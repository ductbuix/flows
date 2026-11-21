import type { PublishPolicy } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Lock, ShieldCheck } from "lucide-react"

type Props = {
  policy: PublishPolicy
  "data-testid"?: string
}

const LOOK: Record<PublishPolicy, { label: string; icon: typeof Lock }> = {
  "read-only": { label: "Read only", icon: Lock },
  "approve-each-publish": {
    label: "Approve each publish",
    icon: ShieldCheck,
  },
}

/** Publish policy Badge (DES-025). Editable Select lands in BL-051. */
export function PublishPolicyBadge({
  policy,
  "data-testid": testId = "policy-badge",
}: Props) {
  const look = LOOK[policy]
  const Icon = look.icon
  return (
    <Badge variant="secondary" data-testid={testId}>
      <Icon />
      {look.label}
    </Badge>
  )
}
