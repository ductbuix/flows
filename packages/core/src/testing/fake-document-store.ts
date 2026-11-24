import { hashUtf8Text } from "../kernel/hash.ts"
import type {
  DocumentRead,
  DocumentRemoveResult,
  DocumentStore,
  DocumentWriteOptions,
  DocumentWriteResult,
} from "../ports/document-store.ts"

function norm(path: string): string {
  return path.replace(/\\/g, "/")
}

function globMatch(glob: string, path: string): boolean {
  const g = norm(glob)
  const p = norm(path)
  if (g === "**" || g === "**/*") return true
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*")
  return new RegExp(`^${escaped}$`).test(p)
}

export function createFakeDocumentStore(): DocumentStore {
  return new FakeDocumentStore()
}

class FakeDocumentStore implements DocumentStore {
  private readonly files = new Map<string, string>()

  read(path: string): DocumentRead | null {
    const key = norm(path)
    if (!this.files.has(key)) return null
    const text = this.files.get(key)!
    return { text, hash: hashUtf8Text(text) }
  }

  write(
    path: string,
    text: string,
    options?: DocumentWriteOptions
  ): DocumentWriteResult {
    const key = norm(path)
    const disk = this.files.get(key) ?? ""
    const diskHash = hashUtf8Text(disk)
    if (options?.baseHash !== undefined && diskHash !== options.baseHash) {
      return { ok: false, kind: "conflict", text: disk, hash: diskHash }
    }
    this.files.set(key, text)
    return { ok: true, text, hash: hashUtf8Text(text) }
  }

  list(glob: string): string[] {
    const g = norm(glob)
    return [...this.files.keys()]
      .filter((p) => globMatch(g, p))
      .sort((a, b) => a.localeCompare(b))
  }

  remove(path: string): DocumentRemoveResult {
    const key = norm(path)
    if (!this.files.has(key)) return { ok: false, kind: "not_found" }
    this.files.delete(key)
    return { ok: true }
  }
}
