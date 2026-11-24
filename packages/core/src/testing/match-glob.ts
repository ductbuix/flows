export function normPath(path: string): string {
  return path.replace(/\\/g, "/")
}

/** Minimal glob match for tests and fakes; patterns use `/` paths. */
export function matchGlob(glob: string, path: string): boolean {
  const g = normPath(glob).replace(/^\//, "")
  const p = normPath(path).replace(/^\//, "")
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*")
  return new RegExp(`^${escaped}$`).test(p)
}

export function matchesAnyGlob(
  globs: readonly string[],
  path: string
): boolean {
  return globs.some((g) => matchGlob(g, path))
}
