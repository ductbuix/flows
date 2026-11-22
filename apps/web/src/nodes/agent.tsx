import { useState } from "react"
import { BotIcon } from "lucide-react"
import type { Effort } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Textarea } from "@workspace/ui/components/textarea"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useCliModels } from "@/hooks/use-cli-models"
import { defineNodeView, type NodeBodyProps, type NodeOf } from "./define"

function AgentBody({
  node,
  text,
  onSetting,
  onText,
  onEditEnd,
}: NodeBodyProps<NodeOf<"agent">>) {
  const { catalog } = useCliModels(node.cli)
  const [cliOpen, setCliOpen] = useState(false)
  return (
    <div className="nodrag flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu open={cliOpen} onOpenChange={setCliOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="node-cli"
              />
            }
          >
            {node.cli}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={node.cli}
              onValueChange={(cli) => {
                onSetting("cli", cli)
                setCliOpen(false)
              }}
            >
              <DropdownMenuRadioItem value="claude">claude</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="cursor">cursor</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ModelSelector
          idPrefix="node-"
          catalog={catalog}
          model={node.model}
          effort={node.effort}
          onChangeModel={(model) => onSetting("model", model)}
          onChangeEffort={(effort: Effort | undefined) =>
            onSetting("effort", effort)
          }
        />
      </div>
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
