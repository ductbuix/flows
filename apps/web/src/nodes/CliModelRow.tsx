import { useState } from "react"
import type { Effort } from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ItemActions } from "@workspace/ui/components/item"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useCliModels } from "@/hooks/use-cli-models"

type Props = {
  cli: "claude" | "cursor"
  model?: string
  effort?: Effort
  onSetting: (key: string, value: unknown) => void
}

/** CLI, model and effort pills shared by the Agent and Judge cards. */
export function CliModelRow({ cli, model, effort, onSetting }: Props) {
  const { catalog } = useCliModels(cli)
  const [cliOpen, setCliOpen] = useState(false)
  return (
    <ItemActions className="flex-wrap gap-1.5">
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
          {cli}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={cli}
            onValueChange={(next) => {
              onSetting("cli", next)
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
        model={model}
        effort={effort}
        onChangeModel={(m) => onSetting("model", m)}
        onChangeEffort={(e: Effort | undefined) => onSetting("effort", e)}
      />
    </ItemActions>
  )
}
