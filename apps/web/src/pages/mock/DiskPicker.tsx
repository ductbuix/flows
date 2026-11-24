import { useRef } from "react"
import { File as FileIcon, FolderOpen } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { pathsToFileTree } from "@workspace/ui/components/file-tree"
import { mono } from "@/components/data/mono"
import type { LibAsset, LibKind } from "./library-types"
import { FilesTree, folderPaths } from "./FilesTree"

export type DiskPick = {
  label: string
  folder: boolean
  assets: LibAsset[]
  kind: LibKind
}

const size = (b: number) =>
  b > 1_000_000
    ? `${(b / 1_000_000).toFixed(1)} MB`
    : b > 1000
      ? `${Math.round(b / 1000)} KB`
      : `${b} B`

const assetKind = (n: string): LibAsset["kind"] =>
  /\.(png|jpe?g|gif|webp|svg)$/i.test(n)
    ? "image"
    : /\.html?$/i.test(n)
      ? "html"
      : /\.md$/i.test(n)
        ? "md"
        : /\.json$/i.test(n)
          ? "json"
          : "file"

/** Opens the system file dialog (Finder on macOS) for a file or a whole folder. */
export function pickFrom(files: File[], folder: boolean): DiskPick | null {
  if (files.length === 0) return null
  const rel = (f: File) => (folder ? f.webkitRelativePath : f.name)
  const assets = files.map((f) => ({
    name: rel(f),
    kind: assetKind(f.name),
    size: size(f.size),
  }))
  const first = files[0]!
  const kind: LibKind =
    !folder && assetKind(first.name) === "image"
      ? "image"
      : !folder && assetKind(first.name) === "html"
        ? "html"
        : "other"
  return {
    label: folder
      ? (first.webkitRelativePath.split("/")[0] ?? first.name)
      : first.name,
    folder,
    assets,
    kind,
  }
}

export function DiskPicker({
  value,
  onChange,
}: {
  value: DiskPick | null
  onChange: (p: DiskPick | null) => void
}) {
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
              {" · copied into its own Library folder"}
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
        <p className="text-sm text-muted-foreground">
          Nothing chosen. Files are copied into the Library; the originals stay
          where they are.
        </p>
      )}
    </div>
  )
}
