import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Secondary id: mono, UUIDs cut to 8 characters, with a copy button. */
export function IdText({ id, copy = true }: { id: string; copy?: boolean }) {
  const shown = UUID_RE.test(id) ? id.slice(0, 8) : id
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="font-mono text-xs text-muted-foreground"
        title={shown === id ? undefined : id}
        data-testid="id-text"
      >
        {shown}
      </span>
      {copy ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="-my-1"
                aria-label="Copy id"
                onClick={(e) => {
                  e.stopPropagation()
                  void navigator.clipboard
                    .writeText(id)
                    .then(() => toast.success("Copied"))
                    .catch(() => toast.error("Could not copy"))
                }}
              />
            }
          >
            <Copy />
          </TooltipTrigger>
          <TooltipContent>Copy id</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  )
}
