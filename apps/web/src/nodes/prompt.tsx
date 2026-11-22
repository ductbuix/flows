import { MessageSquareTextIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { defineNodeView } from "./define"

export const promptView = defineNodeView({
  kind: "prompt",
  icon: MessageSquareTextIcon,
  Body: ({ text, onText, onEditEnd }) => (
    <Textarea
      data-testid="prompt-text"
      aria-label="Prompt text"
      className="nodrag nowheel max-h-40 min-h-16"
      placeholder="Text this node passes on"
      value={text}
      onChange={(e) => onText(e.target.value)}
      onBlur={onEditEnd}
    />
  ),
})
