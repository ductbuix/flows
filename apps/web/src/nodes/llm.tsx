import { SparklesIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { CliModelRow } from "./CliModelRow"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

function LlmBody({
  node,
  text,
  onSetting,
  onText,
  onEditEnd,
}: NodeBodyProps<NodeOf<"llm">>) {
  return (
    <div className="nodrag flex flex-col gap-2">
      <CliModelRow
        cli={node.cli}
        model={node.model}
        effort={node.effort}
        onSetting={onSetting}
      />
      <Textarea
        data-testid="llm-prompt"
        aria-label="Prompt"
        className="nowheel max-h-40 min-h-16"
        placeholder="What should the model write?"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onEditEnd}
      />
    </div>
  )
}

export const llmView = defineNodeView({
  kind: "llm",
  icon: SparklesIcon,
  Body: LlmBody,
})
