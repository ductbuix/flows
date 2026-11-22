import { FolderOutputIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { defineNodeView } from "./define"

export const outputView = defineNodeView({
  kind: "output",
  icon: FolderOutputIcon,
  Body: ({ node }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" data-testid="output-target">
        {node.target === "folder" ? "Folder" : node.target}
      </Badge>
      {node.latest ? (
        <span className="text-xs text-muted-foreground">keeps latest</span>
      ) : null}
    </div>
  ),
})
