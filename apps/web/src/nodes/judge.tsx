import { ScaleIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { CliModelRow } from "./CliModelRow"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

function JudgeBody({
  node,
  text,
  onSetting,
  onText,
  onEditEnd,
}: NodeBodyProps<NodeOf<"judge">>) {
  return (
    <div className="nodrag flex flex-col gap-2">
      <CliModelRow
        cli={node.cli}
        model={node.model}
        effort={node.effort}
        onSetting={onSetting}
      />
      <Textarea
        data-testid="judge-rule"
        aria-label="Rule"
        className="nowheel max-h-40 min-h-16"
        placeholder="What decides yes or no?"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onEditEnd}
      />
    </div>
  )
}

export const judgeView = defineNodeView({
  kind: "judge",
  icon: ScaleIcon,
  Body: JudgeBody,
})
