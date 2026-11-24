import { useRef } from "react"
import { File as FileIcon, FolderOpen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { FilesTree, folderPaths } from "@/components/FilesTree"
import { mono } from "@/components/data/mono"

export type DiskPick = {
  label: string
  folder: boolean
  /** Relative path → browser File (for reading text into library/add). */
  entries: Array<{ path: string; file: File }>
}

/** Build a pick from a file-input FileList. */
export function pickFromFiles(files: File[], folder: boolean): DiskPick | null {
  if (files.length === 0) return null
  const entries = files.map((file) => ({
    path: folder ? file.webkitRelativePath || file.name : file.name,
    file,
  }))
  const first = files[0]!
  return {
    label: folder
      ? (first.webkitRelativePath.split("/")[0] ?? first.name)
      : first.name,
    folder,
    entries,
  }
}

type Props = {
  value: DiskPick | null
  onPick: (pick: DiskPick | null) => void
  mode: "file" | "folder"
  /** When false, hide the tree preview (parent shows a combined one). */
  preview?: boolean
}

/** System file or folder dialog; copies stay where they are until the caller writes. */
export function DiskPicker({ value, onPick, mode, preview = true }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const folder = mode === "folder"
  const active = value && value.folder === folder ? value : null
  const nodes = active
    ? pathsToFileTree(active.entries.slice(0, 60).map((e) => e.path))
    : []

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        data-testid={folder ? "disk-choose-folder" : "disk-choose-file"}
      >
        {folder ? <FolderOpen /> : <FileIcon />}
        {folder ? "Choose folder…" : "Choose file…"}
      </Button>
      <input
        ref={(el) => {
          inputRef.current = el
          if (folder) el?.setAttribute("webkitdirectory", "")
          else el?.removeAttribute("webkitdirectory")
        }}
        type="file"
        hidden
        multiple={folder}
        data-testid={folder ? "disk-folder-input" : "disk-file-input"}
        onChange={(e) => {
          onPick(pickFromFiles([...(e.target.files ?? [])], folder))
          e.target.value = ""
        }}
      />
      {preview && active ? (
        <div className="flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-foreground/10">
          <p className="text-sm">
            <span className={mono}>{active.label}</span>
            <span className="text-muted-foreground">
              {" · "}
              {active.folder
                ? `folder, ${active.entries.length} files`
                : "file"}
            </span>
          </p>
          <div className="max-h-40 overflow-y-auto">
            <FilesTree
              nodes={nodes}
              open={new Set(folderPaths(nodes))}
              selected={null}
              onToggle={() => {}}
              onSelect={() => {}}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

type BothProps = {
  value: DiskPick | null
  onPick: (pick: DiskPick | null) => void
  chosenNote?: string
  emptyHint?: string
}

/** Both file and folder choosers with one shared preview (library / card assets). */
export function DiskPickerBoth({
  value,
  onPick,
  chosenNote = "copied into its own Library folder",
  emptyHint = "Nothing chosen. Files are copied into the Library; the originals stay where they are.",
}: BothProps) {
  const nodes = value
    ? pathsToFileTree(value.entries.slice(0, 60).map((e) => e.path))
    : []
  return (
    <div className="flex flex-col gap-2" data-testid="disk-picker">
      <div className="flex gap-2">
        <DiskPicker mode="file" value={value} onPick={onPick} preview={false} />
        <DiskPicker
          mode="folder"
          value={value}
          onPick={onPick}
          preview={false}
        />
      </div>
      {value ? (
        <div className="flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-foreground/10">
          <p className="text-sm">
            <span className={mono}>{value.label}</span>
            <span className="text-muted-foreground">
              {" · "}
              {value.folder ? `folder, ${value.entries.length} files` : "file"}
              {" · "}
              {chosenNote}
            </span>
          </p>
          <div className="max-h-40 overflow-y-auto">
            <FilesTree
              nodes={nodes}
              open={new Set(folderPaths(nodes))}
              selected={null}
              onToggle={() => {}}
              onSelect={() => {}}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  )
}
