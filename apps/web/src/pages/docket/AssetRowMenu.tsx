import { EllipsisVertical, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

type Props = {
  label: string
  onRemove: () => void
}

/** Per-asset actions; Remove is last and drops the asset from the card. */
export function AssetRowMenu({ label, onRemove }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${label}`}
            className="shrink-0"
            data-testid="asset-row-menu"
          />
        }
      >
        <EllipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onClick={onRemove}
          data-testid="asset-remove"
        >
          <Trash2 />
          Remove asset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
