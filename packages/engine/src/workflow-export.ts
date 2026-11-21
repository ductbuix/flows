import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/** Top-level entries omitted from workflow export/copy (DES-026). */
export function isWorkflowExportOmitted(entryName: string): boolean {
  return entryName === "runs" || entryName === ".cache"
}

/**
 * Copy a workflow tree, skipping `runs/` and `.cache/` so caches and
 * run data stay local (DES-026 / BL-056).
 */
export function copyWorkflowExport(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    if (isWorkflowExportOmitted(name)) continue
    const from = join(src, name)
    const to = join(dest, name)
    const st = statSync(from)
    if (st.isDirectory()) {
      cpSync(from, to, { recursive: true })
    } else {
      cpSync(from, to)
    }
  }
}
