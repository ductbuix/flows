/**
 * True when `id` is a single path segment (no `/`, `\`, or leading `.`).
 * Legacy ids such as `start` stay valid; only new ids use the pattern.
 * Leading `.` is rejected so `.trash` cannot be a task id (DES-022).
 */
export function isSafeTaskId(id: string): boolean {
  if (!id || id.startsWith(".")) return false
  if (id.includes("/") || id.includes("\\")) return false
  return true
}

/**
 * Env var name for an upstream task out dir: `UPSTREAM_` plus the id
 * with every `-` replaced by `_` (DES-020).
 */
export function upstreamEnvName(taskId: string): string {
  return `UPSTREAM_${taskId.replaceAll("-", "_")}`
}
