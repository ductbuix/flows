import { LibraryBigIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { defineNodeView } from "./define"

/** Chips of the chosen library resources; edited in the node Sheet (BL-082). */
export const assetView = defineNodeView({
  kind: "asset",
  icon: LibraryBigIcon,
  Body: ({ node }) =>
    node.resources.length === 0 ? (
      <p className="text-xs text-muted-foreground" data-testid="asset-empty">
        No resources. Add them in settings.
      </p>
    ) : (
      <div className="flex flex-wrap gap-1.5" data-testid="asset-chips">
        {node.access === "propose" ? (
          <Badge variant="secondary" data-testid="asset-access-badge">
            Propose
          </Badge>
        ) : null}
        {node.resources.map((r) => (
          <Badge
            key={`${r.connection}/${r.entity}/${r.id}`}
            variant="outline"
            className="max-w-full truncate"
          >
            {r.connection}/{r.id}
          </Badge>
        ))}
      </div>
    ),
})
