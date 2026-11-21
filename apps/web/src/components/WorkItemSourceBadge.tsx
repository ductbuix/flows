import type { WorkItemSource } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"

type Props = {
  source: WorkItemSource
  "data-testid"?: string
}

/** Outline Badge for a system source; secondary "Ad hoc" otherwise (DES-025). */
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
  return (
    <Badge variant="secondary" data-testid={testId}>
      Ad hoc
    </Badge>
  )
}
