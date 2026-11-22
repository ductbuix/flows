import { BotIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { CliModelRow } from "./CliModelRow"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

function AgentBody({
  node,
  text,
  onSetting,
  onText,
  onEditEnd,
}: NodeBodyProps<NodeOf<"agent">>) {
  return (
    <div className="nodrag flex flex-col gap-2">
      <CliModelRow
        cli={node.cli}
        model={node.model}
        effort={node.effort}
        onSetting={onSetting}
      />
      <Textarea
        data-testid="agent-task"
        aria-label="Task"
        className="nowheel max-h-40 min-h-16"
        placeholder="What should the agent do?"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onEditEnd}
      />
    </div>
  )
}

export const agentView = defineNodeView({
  kind: "agent",
  icon: BotIcon,
  Body: AgentBody,
})
