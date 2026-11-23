/** Reject absolute keys, `..`, empty segments, and NUL (DES-041). */
export function assertSecretKey(key: string): void {
  if (
    key.includes("\0") ||
    key.startsWith("/") ||
    key.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(key)
  ) {
    throw new Error(`invalid secret key: ${key}`)
  }
  const segments = key.split(/[/\\]/)
  if (segments.length === 0 || segments.some((s) => s === "" || s === "..")) {
    throw new Error(`invalid secret key: ${key}`)
  }
}
