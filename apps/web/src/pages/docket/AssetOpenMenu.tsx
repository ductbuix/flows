import { useState } from "react"
import { Code, ExternalLink, Expand, FolderOpen, Trash2 } from "lucide-react"
import { useNavigate } from "react-router"
import type { FlowsClient } from "@workspace/sdk"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { mono } from "@/components/data/mono"
import { errorMessage } from "@/lib/fcp-error"

type Props = {
  client: FlowsClient
  /** Store-relative folder for owned assets (e.g. docket/cards/x/assets). */
  storePath: string
  home: string
  /** Drop the asset from the card; omit on the folder row. */
  onRemove?: () => void
  /** Hide the path line (asset rows). */
  compact?: boolean
  triggerTestId?: string
}

/**
 * Item files menu: view in Files, reveal in Finder, open in Cursor
 * (DK-13 / BL-199).
 */
export function AssetOpenMenu({
  client,
  storePath,
  home,
  onRemove,
  compact,
  triggerTestId = "item-open-menu",
}: Props) {
  const navigate = useNavigate()
  const [note, setNote] = useState<string | null>(null)

  async function reveal() {
    setNote(null)
    try {
      const stat = await client.call("file/stat", { path: storePath })
      await client.call("file/reveal", { path: storePath })
      setNote(`Revealed in Finder (${stat.kind})`)
    } catch (err) {
      setNote(errorMessage(err))
    }
  }

  function openInCursor() {
    const abs = `${home.replace(/\/$/, "")}/${storePath}`
    window.open(`cursor://file${abs}`, "_self")
    setNote("Opening in Cursor…")
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {compact ? (
          <span className="flex-1" />
        ) : (
          <p
            className={`${mono} min-w-0 flex-1 truncate text-xs text-muted-foreground`}
          >
            ~/.flowapp/{storePath}
          </p>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Open in"
                className="shrink-0"
                data-testid={triggerTestId}
              />
            }
          >
            <ExternalLink />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => void navigate("/files")}
              data-testid="item-view-files"
            >
              <Expand />
              View in Files
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void reveal()}
              data-testid="item-open-finder"
            >
              <FolderOpen />
              Finder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={openInCursor}
              data-testid="item-open-cursor"
            >
              <Code />
              Cursor
            </DropdownMenuItem>
            {onRemove ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onRemove}
                  data-testid="asset-remove"
                >
                  <Trash2 />
                  Remove asset
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {note ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="item-open-note"
        >
          {note}
        </p>
      ) : null}
    </div>
  )
}
