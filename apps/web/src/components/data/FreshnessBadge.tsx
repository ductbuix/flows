import { Badge } from "@workspace/ui/components/badge"
import { Leaf, Clock } from "lucide-react"

type Props = {
  fresh: boolean
  "data-testid"?: string
}

/** Freshness Badge: secondary Fresh, outline Stale (DES-025). */
export function FreshnessBadge({
  fresh,
  "data-testid": testId = "freshness-badge",
}: Props) {
  if (fresh) {
    return (
      <Badge variant="secondary" data-testid={testId}>
        <Leaf />
        Fresh
      </Badge>
    )
  }
  return (
    <Badge variant="outline" data-testid={testId}>
      <Clock />
      Stale
    </Badge>
  )
}
