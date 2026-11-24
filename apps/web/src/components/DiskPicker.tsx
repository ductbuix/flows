import { useRef } from "react"
import { File as FileIcon, FolderOpen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { mono } from "@/components/data/mono"
import { FilesTree, folderPaths } from "@/pages/mock/FilesTree"

export type DiskAssetKind = "image" | "html" | "md" | "json" | "file"

export type DiskAsset = {
  name: string
  kind: DiskAssetKind
  size: string
}

export type DiskPickKind = "image" | "html" | "other"

/** Result of a system file/folder pick; `files` keeps the blobs for upload. */
export type DiskPick = {
  label: string
  folder: boolean
  assets: DiskAsset[]
  files: File[]
  kind: DiskPickKind
}

const sizeLabel = (b: number) =>
  b > 1_000_000
    ? `${(b / 1_000_000).toFixed(1)} MB`
    : b > 1000
      ? `${Math.round(b / 1000)} KB`
      : `${b} B`

export function assetKindOf(name: string): DiskAssetKind {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image"
  if (/\.html?$/i.test(name)) return "html"
  if (/\.md$/i.test(name)) return "md"
  if (/\.json$/i.test(name)) return "json"
  return "file"
}

/** Opens the system file dialog (Finder on macOS) for a file or a whole folder. */
export function pickFrom(files: File[], folder: boolean): DiskPick | null {
  if (files.length === 0) return null
  const rel = (f: File) => (folder ? f.webkitRelativePath || f.name : f.name)
  const assets = files.map((f) => ({
    name: rel(f),
    kind: assetKindOf(f.name),
    size: sizeLabel(f.size),
  }))
  const first = files[0]!
  const kind: DiskPickKind =
    !folder && assetKindOf(first.name) === "image"
      ? "image"
      : !folder && assetKindOf(first.name) === "html"
        ? "html"
        : "other"
  return {
    label: folder
      ? (first.webkitRelativePath.split("/")[0] ?? first.name)
      : first.name,
    folder,
    assets,
    files,
    kind,
  }
}

type Props = {
  value: DiskPick | null
  onChange: (p: DiskPick | null) => void
  /** Shown under the chosen summary; library vs card assets differ. */
  chosenNote?: string
  emptyHint?: string
}

/** Shared file/folder picker (card assets and library add). */
export function DiskPicker({
  value,
  onChange,
  chosenNote = "copied into the app",
  emptyHint = "Nothing chosen. The originals stay where they are.",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement | null>(null)
  const nodes = value
    ? pathsToFileTree(value.assets.slice(0, 60).map((a) => a.name))
    : []
  return (
    <div className="flex flex-col gap-2" data-testid="disk-picker">
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          data-testid="disk-choose-file"
        >
          <FileIcon />
          Choose file…
        </Button>
        <Button
          variant="outline"
          onClick={() => dirRef.current?.click()}
          data-testid="disk-choose-folder"
        >
          <FolderOpen />
          Choose folder…
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        data-testid="disk-file-input"
        onChange={(e) => {
          onChange(pickFrom([...(e.target.files ?? [])], false))
          e.target.value = ""
        }}
      />
      <input
        ref={(el) => {
          dirRef.current = el
          el?.setAttribute("webkitdirectory", "")
        }}
        type="file"
        hidden
        data-testid="disk-folder-input"
        onChange={(e) => {
          onChange(pickFrom([...(e.target.files ?? [])], true))
          e.target.value = ""
        }}
      />
      {value ? (
        <div className="flex flex-col gap-1 rounded-2xl p-3 ring-1 ring-foreground/10">
          <p className="text-sm">
            <span className={mono}>{value.label}</span>
            <span className="text-muted-foreground">
              {" · "}
              {value.folder ? `folder, ${value.assets.length} files` : "file"}
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
