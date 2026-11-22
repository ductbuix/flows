import { ZapIcon } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { defineNodeView } from "./define"

export const triggerView = defineNodeView({
  kind: "trigger",
  icon: ZapIcon,
  Body: ({ node }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" data-testid="trigger-type">
        {node.type === "manual" ? "Manual" : node.type}
      </Badge>
      {node.inputs?.length ? (
        <span className="text-xs text-muted-foreground">
          {node.inputs.length} {node.inputs.length === 1 ? "input" : "inputs"}
        </span>
      ) : null}
    </div>
  ),
})
