import { useState } from "react"
import { HandIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

/** Keeps the draft while empty: `question` may not be empty in YAML. */
function ApprovalBody({
  node,
  onSetting,
  onEditEnd,
}: NodeBodyProps<NodeOf<"approval">>) {
  const [draft, setDraft] = useState(node.question)
  const shown =
    draft.trim() === "" || draft === node.question ? draft : node.question
  return (
    <Textarea
      data-testid="approval-question"
      aria-label="Question"
      aria-invalid={shown.trim() === "" || undefined}
      className="nodrag nowheel max-h-40 min-h-16"
      placeholder="What should a person decide?"
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value.trim() !== "") onSetting("question", e.target.value)
      }}
      onBlur={() => {
        setDraft(node.question)
        onEditEnd()
      }}
    />
  )
}

export const approvalView = defineNodeView({
  kind: "approval",
  icon: HandIcon,
  Body: ApprovalBody,
})
