import { FolderOutputIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { defineNodeView } from "./define"

export const outputView = defineNodeView({
  kind: "output",
  icon: FolderOutputIcon,
  Body: ({ node }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" data-testid="output-target">
        {node.target === "publish"
          ? "Publish"
          : node.target === "notify"
            ? "Notify"
            : "Folder"}
      </Badge>
      {node.target === "publish" && node.connection ? (
        <Badge variant="secondary" data-testid="output-connection">
          {node.connection}
        </Badge>
      ) : null}
      {node.target === "notify" && node.title ? (
        <span
          className="text-xs text-muted-foreground"
          data-testid="output-title-text"
        >
          {node.title}
        </span>
      ) : null}
      {node.latest ? (
        <span className="text-xs text-muted-foreground">keeps latest</span>
      ) : null}
    </div>
  ),
})
