/**
 * Store-relative path helpers for file/* (DES-040).
 * DocumentStore paths are relative to FLOWAPP_HOME; leading `/` is optional.
 */

/** Normalize separators and `.` / `..`; null when `..` escapes the store root. */
export function normalizeStorePath(path: string): string | null {
  let rel = path.replace(/\\/g, "/")
  if (rel.startsWith("/")) rel = rel.slice(1)
  const out: string[] = []
  for (const part of rel.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join("/")
}

function rootPrefix(root: string): string {
  const n = normalizeStorePath(root)
  if (n === null) return ""
  return n
}

/** True when `path` equals `root` or is a descendant (store-relative). */
export function isUnderStoreRoot(path: string, root: string): boolean {
  const r = rootPrefix(root)
  if (r === "") return true
  return path === r || path.startsWith(`${r}/`)
}

/**
 * Confine `path` to one of `roots`. Empty root `""` means the whole store.
 * Returns the normalized store path, or null when outside / escaping.
 */
export function confineToRoots(
  path: string,
  roots: readonly string[]
): string | null {
  const normalized = normalizeStorePath(path)
  if (normalized === null) return null
  for (const root of roots) {
    if (isUnderStoreRoot(normalized, root)) return normalized
  }
  return null
}
