import {
  fileListMethod,
  fileReadTextMethod,
  fileRevealMethod,
  fileStatMethod,
  fileWriteTextMethod,
  type FcpMethodResult,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import { confineToRoots, normalizeStorePath } from "./paths.ts"

const DEFAULT_LIST_LIMIT = 100
const ALL_FILES_GLOB = "**"

export type FileServiceDeps = {
  docs: DocumentStore
  /** Store-relative prefixes; `""` allows the whole workspace. */
  allowedRoots: readonly string[]
  /** Host reveal (Finder); omit → `unsupported`. */
  reveal?: (path: string) => void | Promise<void>
}

export type FileBindings = Pick<
  MethodBindings,
  | "file/list"
  | "file/stat"
  | "file/read_text"
  | "file/write_text"
  | "file/reveal"
>

type FileEntry = FcpMethodResult<typeof fileListMethod>["items"][number]

export function createFileBindings(deps: FileServiceDeps): FileBindings {
  return {
    "file/list": defineBinding(fileListMethod, (params) => {
      const prefix = confineOrThrow(params.path ?? "", deps.allowedRoots)
      return pageEntries(
        listUnder(deps.docs, prefix),
        params.cursor,
        params.limit
      )
    }),
    "file/stat": defineBinding(fileStatMethod, (params) => {
      const path = confineOrThrow(params.path, deps.allowedRoots)
      const file = deps.docs.read(path)
      if (file) {
        return {
          path,
          kind: "file" as const,
          hash: file.hash,
          size: utf8Size(file.text),
        }
      }
      if (hasDescendant(deps.docs, path)) {
        return { path, kind: "dir" as const }
      }
      throw engineError("not_found", `Path not found: ${path}`)
    }),
    "file/read_text": defineBinding(fileReadTextMethod, (params) => {
      const path = confineOrThrow(params.path, deps.allowedRoots)
      const file = deps.docs.read(path)
      if (!file) throw engineError("not_found", `File not found: ${path}`)
      return { path, text: file.text, hash: file.hash }
    }),
    "file/write_text": defineBinding(fileWriteTextMethod, (params) => {
      const path = confineOrThrow(params.path, deps.allowedRoots)
      const written = deps.docs.write(path, params.text, {
        baseHash: params.baseHash,
      })
      if (!written.ok) {
        throw engineError("conflict", "Stale baseHash", {
          current: { path, text: written.text, hash: written.hash },
        })
      }
      return { path, hash: written.hash }
    }),
    "file/reveal": defineBinding(fileRevealMethod, async (params) => {
      const path = confineOrThrow(params.path, deps.allowedRoots)
      if (!deps.reveal) {
        throw engineError("unsupported", "Reveal is not available on this host")
      }
      await deps.reveal(path)
      return {}
    }),
  }
}

function confineOrThrow(path: string, roots: readonly string[]): string {
  const confined = confineToRoots(path, roots)
  if (confined === null) {
    throw engineError("policy_denied", "Path is outside allowed roots")
  }
  return confined
}

function listUnder(docs: DocumentStore, prefix: string): FileEntry[] {
  const files = docs.list(ALL_FILES_GLOB).map((p) => normalizeStorePath(p) ?? p)
  const entries = new Map<string, FileEntry>()
  for (const filePath of files) {
    if (
      prefix !== "" &&
      filePath !== prefix &&
      !filePath.startsWith(`${prefix}/`)
    ) {
      continue
    }
    entries.set(filePath, { path: filePath, kind: "file" })
    if (filePath === prefix) continue
    const rel = prefix === "" ? filePath : filePath.slice(prefix.length + 1)
    const parts = rel.split("/")
    for (let i = 1; i < parts.length; i++) {
      const dirRel = parts.slice(0, i).join("/")
      const dirPath = prefix === "" ? dirRel : `${prefix}/${dirRel}`
      if (!entries.has(dirPath)) {
        entries.set(dirPath, { path: dirPath, kind: "dir" })
      }
    }
  }
  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path))
}

function hasDescendant(docs: DocumentStore, prefix: string): boolean {
  const files = docs.list(ALL_FILES_GLOB).map((p) => normalizeStorePath(p) ?? p)
  if (prefix === "") return files.length > 0
  return files.some((p) => p === prefix || p.startsWith(`${prefix}/`))
}

function pageEntries(
  entries: FileEntry[],
  cursor?: string,
  limit = DEFAULT_LIST_LIMIT
): { items: FileEntry[]; next?: string } {
  let start = 0
  if (cursor) {
    const at = entries.findIndex((e) => e.path === cursor)
    start = at === -1 ? 0 : at + 1
  }
  const page = entries.slice(start, start + limit)
  const hasMore = start + limit < entries.length
  const next =
    hasMore && page.length > 0 ? page[page.length - 1]!.path : undefined
  return { items: page, next }
}

function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length
}
