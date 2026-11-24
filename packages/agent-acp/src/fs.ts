import { randomBytes } from "node:crypto"
import {
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises"
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path"
import { z } from "zod"
import {
  JSONRPC_INVALID_PARAMS,
  JsonRpcResponseError,
  type RpcPeer,
} from "@workspace/protocol"

const readParamsSchema = z.object({
  sessionId: z.string(),
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  limit: z.number().int().nonnegative().optional(),
})

const writeParamsSchema = z.object({
  sessionId: z.string(),
  path: z.string().min(1),
  content: z.string(),
})

export type AcpFsOptions = {
  sessionId: string
  /** Absolute roots the agent may read/write (step work dir). */
  allowedRoots: readonly string[]
}

function pathDenied(message: string): never {
  throw new JsonRpcResponseError({
    code: JSONRPC_INVALID_PARAMS,
    message,
  })
}

function isUnderRoot(absPath: string, root: string): boolean {
  const path = resolve(absPath)
  const base = resolve(root)
  return path === base || path.startsWith(`${base}${sep}`)
}

/**
 * Resolve `path` and ensure the real location stays under an allowed root.
 * Rejects `..` escapes and symlink escapes.
 */
export async function resolveUnderRoots(
  path: string,
  allowedRoots: readonly string[]
): Promise<string> {
  if (!isAbsolute(path)) {
    pathDenied(`fs path must be absolute: ${path}`)
  }
  if (allowedRoots.length === 0) {
    pathDenied("no allowed filesystem roots")
  }

  const lexical = resolve(path)
  // Compare against both the given roots and their realpaths: on macOS
  // `/var` is a symlink to `/private/var`, so a cwd under `/var/...` and a
  // path using that form must still match the real root.
  const rootForms = [
    ...allowedRoots.map((root) => resolve(root)),
    ...(await Promise.all(
      allowedRoots.map(async (root) => resolve(await realpath(root)))
    )),
  ]

  if (!rootForms.some((root) => isUnderRoot(lexical, root))) {
    pathDenied(`path outside allowed roots: ${path}`)
  }

  const real = await realpathExistingPrefix(lexical)
  if (!rootForms.some((root) => isUnderRoot(real, root))) {
    pathDenied(`path outside allowed roots: ${path}`)
  }
  return real
}

/** Realpath the longest existing prefix, then rejoin missing segments. */
async function realpathExistingPrefix(absPath: string): Promise<string> {
  const missing: string[] = []
  let current = absPath
  for (;;) {
    try {
      const real = await realpath(current)
      if (missing.length === 0) return real
      return join(real, ...missing)
    } catch {
      const parent = dirname(current)
      if (parent === current) {
        pathDenied(`cannot resolve path: ${absPath}`)
      }
      missing.unshift(basename(current))
      current = parent
    }
  }
}

/** Write utf8 via temp file in the same directory, then rename. */
export async function writeTextAtomic(
  path: string,
  content: string
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = join(
    dirname(path),
    `.${Date.now()}-${randomBytes(4).toString("hex")}.tmp`
  )
  try {
    await writeFile(tmp, content, "utf8")
    await rename(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => undefined)
    throw err
  }
}

function sliceLines(
  text: string,
  line: number | undefined,
  limit: number | undefined
): string {
  if (line === undefined && limit === undefined) return text
  const lines = text.split("\n")
  const start = line === undefined ? 0 : line - 1
  const end = limit === undefined ? undefined : start + limit
  return lines.slice(start, end).join("\n")
}

async function handleRead(
  params: unknown,
  options: AcpFsOptions
): Promise<{ content: string }> {
  const parsed = readParamsSchema.safeParse(params)
  if (!parsed.success) {
    pathDenied(`invalid fs/read_text_file params: ${parsed.error.message}`)
  }
  if (parsed.data.sessionId !== options.sessionId) {
    pathDenied("fs/read_text_file wrong session")
  }
  const abs = await resolveUnderRoots(parsed.data.path, options.allowedRoots)
  const raw = await readFile(abs, "utf8")
  return {
    content: sliceLines(raw, parsed.data.line, parsed.data.limit),
  }
}

async function handleWrite(
  params: unknown,
  options: AcpFsOptions
): Promise<Record<string, never>> {
  const parsed = writeParamsSchema.safeParse(params)
  if (!parsed.success) {
    pathDenied(`invalid fs/write_text_file params: ${parsed.error.message}`)
  }
  if (parsed.data.sessionId !== options.sessionId) {
    pathDenied("fs/write_text_file wrong session")
  }
  const abs = await resolveUnderRoots(parsed.data.path, options.allowedRoots)
  await writeTextAtomic(abs, parsed.data.content)
  return {}
}

/** Register `fs/read_text_file` and `fs/write_text_file` on the peer. */
export function attachFsHandlers(
  peer: RpcPeer,
  options: AcpFsOptions
): () => void {
  const unsubRead = peer.onRequest("fs/read_text_file", (params) =>
    handleRead(params, options)
  )
  const unsubWrite = peer.onRequest("fs/write_text_file", (params) =>
    handleWrite(params, options)
  )
  return () => {
    unsubRead()
    unsubWrite()
  }
}
