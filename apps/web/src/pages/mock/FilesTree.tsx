import { ChevronRight, File, Folder } from "lucide-react"
import type { FileNode } from "@workspace/ui/components/file-tree"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { cn } from "@workspace/ui/lib/utils"

export function folderPaths(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) =>
    n.type === "folder" ? [n.path, ...folderPaths(n.children)] : []
  )
}

type Props = {
  nodes: FileNode[]
  open: Set<string>
  selected: string | null
  onToggle: (path: string, open: boolean) => void
  onSelect: (path: string) => void
}

/** A controlled file tree, so the page can expand or collapse every folder. */
export function FilesTree({ nodes, open, selected, onToggle, onSelect }: Props) {
  return (
    <div className="flex flex-col text-sm" data-testid="files-tree">
      {nodes.map((n) => (
        <Node key={n.path} node={n} {...{ open, selected, onToggle, onSelect }} />
      ))}
    </div>
  )
}

function Node({ node, open, selected, onToggle, onSelect }: Omit<Props, "nodes"> & { node: FileNode }) {
  if (node.type === "file") {
    return (
      <Button
        variant="ghost"
        className={cn("w-full justify-start font-normal", selected === node.path && "bg-accent text-accent-foreground")}
        aria-current={selected === node.path ? "true" : undefined}
        data-testid={`out-file-${node.path}`}
        onClick={() => onSelect(node.path)}
      >
        <File />
        <span className="truncate">{node.name}</span>
      </Button>
    )
  }
  const isOpen = open.has(node.path)
  return (
    <Collapsible open={isOpen} onOpenChange={(o) => onToggle(node.path, o)}>
      <CollapsibleTrigger
        render={<Button variant="ghost" className="w-full justify-start font-normal aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50" data-testid={`out-folder-${node.path}`} />}
      >
        <ChevronRight className={cn("transition-transform", isOpen && "rotate-90")} />
        <Folder />
        <span className="truncate">{node.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 flex flex-col">
          {node.children.map((c) => (
            <Node key={c.path} node={c} {...{ open, selected, onToggle, onSelect }} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
