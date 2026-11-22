import { useState } from "react"
import { TerminalIcon } from "lucide-react"
import { Textarea } from "@workspace/ui/components/textarea"
import { mono } from "@/components/data/mono"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

/** Keeps the draft while empty: `run` may not be empty in YAML. */
function CommandBody({
  node,
  onSetting,
  onEditEnd,
}: NodeBodyProps<NodeOf<"command">>) {
  const [draft, setDraft] = useState(node.run)
  const shown = draft.trim() === "" || draft === node.run ? draft : node.run
  return (
    <Textarea
      data-testid="command-run"
      aria-label="Command"
      aria-invalid={shown.trim() === "" || undefined}
      className={`nodrag nowheel max-h-40 min-h-16 ${mono}`}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value)
        if (e.target.value.trim() !== "") onSetting("run", e.target.value)
      }}
      onBlur={() => {
        setDraft(node.run)
        onEditEnd()
      }}
    />
  )
}

export const commandView = defineNodeView({
  kind: "command",
  icon: TerminalIcon,
  Body: CommandBody,
})
