import type { WorkItemSource } from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { BookMarked } from "lucide-react"

type Props = {
  source: WorkItemSource
  "data-testid"?: string
}

/** Source Badge: secondary Ad hoc, outline library entity (DES-025). */
export function WorkItemSourceBadge({
  source,
  "data-testid": testId = "work-item-source",
}: Props) {
  if (source.kind === "adhoc") {
    return (
      <Badge variant="secondary" data-testid={testId}>
        Ad hoc
      </Badge>
    )
  }
  return (
    <Badge variant="outline" data-testid={testId}>
      <BookMarked />
      {source.connection}
    </Badge>
  )
}
