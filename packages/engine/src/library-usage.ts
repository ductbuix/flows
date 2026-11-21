import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { DEFAULT_LIBRARY_MAX_BYTES, type LibraryUsage } from "@workspace/shared"
import { loadAppConfig } from "./config.ts"
import { libraryDir } from "./paths.ts"

export class LibraryCapError extends Error {
  readonly code = "library_cap" as const
  constructor(
    readonly usedBytes: number,
    readonly maxBytes: number
  ) {
    super(
      `Library is at the size cap (${formatBytes(usedBytes)} of ${formatBytes(maxBytes)}). Clear unused revisions or raise library.maxBytes in config.yaml. Pinned revisions were not deleted.`
    )
    this.name = "LibraryCapError"
  }
}

export function libraryMaxBytes(home: string): number {
  return loadAppConfig(home).library?.maxBytes ?? DEFAULT_LIBRARY_MAX_BYTES
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = n
  let i = -1
  do {
    v /= 1024
    i += 1
  } while (v >= 1024 && i < units.length - 1)
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/** Recursive byte size of a path; missing path is 0. */
export function pathByteSize(root: string): number {
  if (!existsSync(root)) return 0
  const st = statSync(root)
  if (st.isFile() || st.isSymbolicLink()) return st.size
  if (!st.isDirectory()) return 0
  let total = 0
  for (const name of readdirSync(root)) {
    total += pathByteSize(join(root, name))
  }
  return total
}

export function libraryUsage(home: string): LibraryUsage {
  return {
    usedBytes: pathByteSize(libraryDir(home)),
    maxBytes: libraryMaxBytes(home),
  }
}

/** Throw LibraryCapError when usedBytes >= maxBytes. */
export function assertLibraryHasSpace(home: string): void {
  const usage = libraryUsage(home)
  if (usage.usedBytes >= usage.maxBytes) {
    throw new LibraryCapError(usage.usedBytes, usage.maxBytes)
  }
}
