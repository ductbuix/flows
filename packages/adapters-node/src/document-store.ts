import { createHash, randomBytes } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { minimatch } from "minimatch"
import type {
  DocumentRead,
  DocumentRemoveResult,
  DocumentStore,
  DocumentWriteOptions,
  DocumentWriteResult,
} from "@workspace/core/ports"

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

function writeAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = join(
    dirname(path),
    `.${Date.now()}-${randomBytes(4).toString("hex")}.tmp`
  )
  writeFileSync(tmp, data, "utf8")
  renameSync(tmp, path)
}

function walkFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(abs, out)
    else if (entry.isFile()) out.push(abs)
  }
}

function resolvePath(root: string | undefined, path: string): string {
  if (!root) return path
  return join(root, path.replace(/^\//, ""))
}

function toStorePath(root: string | undefined, abs: string): string {
  if (!root) return abs
  return `/${relative(root, abs).split("\\").join("/")}`
}

export function createNodeDocumentStore(options?: {
  root?: string
}): DocumentStore {
  const root = options?.root

  return {
    read(path: string): DocumentRead | null {
      const abs = resolvePath(root, path)
      if (!existsSync(abs)) return null
      const text = readFileSync(abs, "utf8")
      return { text, hash: hashText(text) }
    },

    write(
      path: string,
      text: string,
      opts?: DocumentWriteOptions
    ): DocumentWriteResult {
      const abs = resolvePath(root, path)
      const disk = existsSync(abs) ? readFileSync(abs, "utf8") : ""
      const diskHash = hashText(disk)
      if (opts?.baseHash !== undefined && diskHash !== opts.baseHash) {
        return { ok: false, kind: "conflict", text: disk, hash: diskHash }
      }
      writeAtomic(abs, text)
      return { ok: true, text, hash: hashText(text) }
    },

    list(glob: string): string[] {
      if (!root || !existsSync(root)) return []
      const files: string[] = []
      walkFiles(root, files)
      const pattern = glob.replace(/^\//, "")
      return files
        .map((abs) => toStorePath(root, abs))
        .filter((p) => minimatch(p.replace(/^\//, ""), pattern))
        .sort((a, b) => a.localeCompare(b))
    },

    remove(path: string): DocumentRemoveResult {
      const abs = resolvePath(root, path)
      if (!existsSync(abs)) return { ok: false, kind: "not_found" }
      unlinkSync(abs)
      return { ok: true }
    },
  }
}
