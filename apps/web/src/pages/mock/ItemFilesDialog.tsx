import { useState } from "react"
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { mono } from "@/components/data/mono"
import { libraryPath, type LibItem } from "./library-types"
import { FilePreview } from "./FilePreview"
import { FilesTree, folderPaths } from "./FilesTree"

/** Read-only look at every file of an item, same tree and preview as the Files page. */
export function ItemFilesDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LibItem
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const nodes = pathsToFileTree(item.assets.map((a) => a.name))
  const folders = folderPaths(nodes)
  const [openSet, setOpenSet] = useState(() => new Set(folders))
  const [selected, setSelected] = useState<string | null>(null)
  const allOpen = folders.length > 0 && folders.every((f) => openSet.has(f))
  const root = libraryPath(item)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="item-files-dialog">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>
            Read-only · <span className={mono}>~/.flowapp/{root}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid h-96 grid-cols-5 gap-3">
          <div className="col-span-2 flex min-h-0 flex-col gap-2 rounded-3xl p-2 ring-1 ring-foreground/10">
            <Button
              variant="outline"
              size="icon"
              className="self-end"
              disabled={folders.length === 0}
              aria-label={allOpen ? "Collapse all" : "Expand all"}
              onClick={() => setOpenSet(allOpen ? new Set() : new Set(folders))}
            >
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </Button>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FilesTree
                nodes={nodes}
                open={openSet}
                selected={selected}
                onToggle={(p, o) =>
                  setOpenSet((prev) => {
                    const next = new Set(prev)
                    if (o) next.add(p)
                    else next.delete(p)
                    return next
                  })
                }
                onSelect={setSelected}
              />
            </div>
          </div>
          <div className="col-span-3 min-h-0 overflow-y-auto rounded-3xl ring-1 ring-foreground/10">
            <FilePreview path={selected ? `${root}${selected}` : null} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
