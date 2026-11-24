import type { RunStatus } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import {
  Ban,
  Check,
  CircleAlert,
  Clock,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"

type Props = {
  status: RunStatus
  /** When true, show Awaiting approval (DES-025 needsYou). */
  needsYou?: boolean
  "data-testid"?: string
}

type Look = {
  variant: "default" | "secondary" | "destructive" | "outline"
  label: string
  icon: typeof Check
  spin?: boolean
}

function lookFor(status: RunStatus, needsYou: boolean): Look {
  if (needsYou) {
    return {
      variant: "default",
      label: "Awaiting approval",
      icon: ShieldCheck,
    }
  }
  switch (status) {
    case "succeeded":
      return { variant: "secondary", label: status, icon: Check }
    case "running":
      return {
        variant: "outline",
        label: status,
        icon: LoaderCircle,
        spin: true,
      }
    case "failed":
      return { variant: "destructive", label: status, icon: CircleAlert }
    case "queued":
      return { variant: "outline", label: status, icon: Clock }
    case "cancelled":
      return { variant: "secondary", label: status, icon: Ban }
  }
}

/** Run status Badge with icon per DES-025. */
export function RunStatusBadge({
  status,
  needsYou = false,
  "data-testid": testId = "run-status",
}: Props) {
  const look = lookFor(status, needsYou)
  const Icon = look.icon
  return (
    <Badge variant={look.variant} data-testid={testId}>
      <Icon className={look.spin ? "animate-spin" : undefined} />
      {look.label}
    </Badge>
  )
}
