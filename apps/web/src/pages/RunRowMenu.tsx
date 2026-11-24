import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ItemActions } from "@workspace/ui/components/item"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { MoreHorizontal } from "lucide-react"

type Props = {
  runId: string
  live: boolean
  onDelete: () => void
}

export function RunRowMenu({ runId, live, onDelete }: Props) {
  return (
    <ItemActions>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              data-testid={`run-menu-${runId}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {live ? (
            <Tooltip>
              <TooltipTrigger render={<span className="block w-full" />}>
                <DropdownMenuItem
                  variant="destructive"
                  disabled
                  data-testid="run-delete"
                >
                  Delete run
                </DropdownMenuItem>
              </TooltipTrigger>
              <TooltipContent>Cancel the run before deleting it</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              data-testid="run-delete"
              onClick={onDelete}
            >
              Delete run
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  )
}
