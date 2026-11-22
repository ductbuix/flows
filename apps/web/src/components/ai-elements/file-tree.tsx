/**
 * Adapted from shadcn apps/v4/examples/base/file-tree-demo.tsx (shadcn-ui/ui@bfa64ff).
 * Changed base-rhea to base-nova: imports use @workspace/ui/components/*, not @/styles/base-rhea/ui/*; chat demo wiring (useChat, Bubble, Message) removed.
 */
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"

export type FileNode =
  | { type: "file"; name: string; path: string }
  | { type: "folder"; name: string; path: string; children: FileNode[] }

type NodeProps = {
  node: FileNode
  selected?: string
  onSelect?: (path: string) => void
}

function FileTreeNode({ node, selected, onSelect }: NodeProps) {
  if (node.type === "folder") {
    return (
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="w-full justify-start font-normal aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50"
            />
          }
        >
          <ChevronRightIcon className="transition-transform group-data-panel-open/button:rotate-90" />
          <FolderIcon />
          {node.name}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 flex flex-col">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start font-normal ${
        selected === node.path ? "bg-accent text-accent-foreground" : ""
      }`}
      aria-current={selected === node.path ? "true" : undefined}
      data-testid={`out-file-${node.path}`}
      onClick={() => onSelect?.(node.path)}
    >
      <FileIcon />
      {node.name}
    </Button>
  )
}

type Props = {
  roots: FileNode[]
  selected?: string
  onSelect?: (path: string) => void
  "data-testid"?: string
}

/** File Tree pattern for out/ (AI Elements). */
export function FileTree({
  roots,
  selected,
  onSelect,
  "data-testid": testId,
}: Props) {
  return (
    <div className="flex w-full flex-col text-sm" data-testid={testId}>
      {roots.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

/** Build a folder tree from flat relative paths. */
export function pathsToFileTree(paths: string[]): FileNode[] {
  type MutableFolder = {
    type: "folder"
    name: string
    path: string
    children: Map<string, MutableFolder | FileNode>
  }

  const root: MutableFolder = {
    type: "folder",
    name: "",
    path: "",
    children: new Map(),
  }

  for (const full of paths) {
    const parts = full.split("/").filter(Boolean)
    let cursor = root
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join("/")
      if (isFile) {
        cursor.children.set(part, { type: "file", name: part, path })
        return
      }
      let next = cursor.children.get(part)
      if (!next || next.type !== "folder") {
        next = {
          type: "folder",
          name: part,
          path,
          children: new Map(),
        }
        cursor.children.set(part, next)
      }
      cursor = next as MutableFolder
    })
  }

  function freeze(folder: MutableFolder): FileNode[] {
    return [...folder.children.values()]
      .map((child) =>
        child.type === "folder"
          ? {
              type: "folder" as const,
              name: child.name,
              path: child.path,
              children: freeze(child),
            }
          : child
      )
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  return freeze(root)
}
