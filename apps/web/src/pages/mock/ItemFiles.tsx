import { useState } from "react"
import { ChevronDown, Code, Expand, FolderOpen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { mono } from "@/components/data/mono"
import { libraryPath, type LibItem } from "./library-types"
import { FilesTree, folderPaths } from "./FilesTree"
import { ItemFilesDialog } from "./ItemFilesDialog"

/** The item's own folder on disk, as a tree. Remount (key) when the item changes. */
export function ItemFiles({ item }: { item: LibItem }) {
  const nodes = pathsToFileTree(item.assets.map((a) => a.name))
  const [open, setOpen] = useState(() => new Set(folderPaths(nodes)))
  const [viewing, setViewing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className={`${mono} min-w-0 flex-1 truncate text-xs text-muted-foreground`}>
          ~/.flowapp/{libraryPath(item)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" data-testid="item-open-menu" />}>
            Open in
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewing(true)} data-testid="item-view-files">
              <Expand />
              Browse in app
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNote("Opened in Finder (mock)")} data-testid="item-open-finder">
              <FolderOpen />
              Finder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNote("Opened in Cursor (mock)")} data-testid="item-open-cursor">
              <Code />
              Cursor
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {item.assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet</p>
      ) : (
        <FilesTree
          nodes={nodes}
          open={open}
          selected={null}
          onToggle={(p, o) =>
            setOpen((prev) => {
              const next = new Set(prev)
              if (o) next.add(p)
              else next.delete(p)
              return next
            })
          }
          onSelect={() => setViewing(true)}
        />
      )}
      {viewing ? <ItemFilesDialog item={item} open onOpenChange={setViewing} /> : null}
    </div>
  )
}
