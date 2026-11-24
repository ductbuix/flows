/** Display labels for `file/stat` preview chrome (mock metaOf parity). */

const EXT_KIND: Record<string, string> = {
  yaml: "YAML",
  yml: "YAML",
  json: "JSON",
  md: "Markdown",
  db: "SQLite database",
}

export function fileKindLabel(
  path: string,
  kind: "file" | "dir"
): string {
  if (kind === "dir") return "Folder"
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return EXT_KIND[ext] ?? "File"
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} KB`
  return `${bytes} B`
}

export function formatStatLine(
  path: string,
  stat: { kind: "file" | "dir"; size?: number }
): string {
  const kind = fileKindLabel(path, stat.kind)
  if (stat.size === undefined) return kind
  return `${kind} · ${formatFileSize(stat.size)}`
}
