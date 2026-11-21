import type { WorkItemSource } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { BookMarked } from "lucide-react"

type Props = {
  source: WorkItemSource
  "data-testid"?: string
}

/**
 * Source Badge: secondary Ad hoc; outline Rally or library entity
 * (DES-025 / BL-046 / BL-055).
 */
export function WorkItemSourceBadge({
  source,
  "data-testid": testId = "work-item-source",
}: Props) {
  if (source.kind === "rally") {
    return (
      <Badge variant="outline" data-testid={testId}>
        Rally {source.entityId}
      </Badge>
    )
  }
  if (source.kind === "library") {
    return (
      <Badge variant="outline" data-testid={testId}>
        <BookMarked />
        {source.connection}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" data-testid={testId}>
      Ad hoc
    </Badge>
  )
}
