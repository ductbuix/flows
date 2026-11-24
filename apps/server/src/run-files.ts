import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs"
import { join, resolve, sep } from "node:path"
import {
  attemptRootOf,
  runDir,
  stepDir,
  workflowDir,
  type Host,
} from "@workspace/adapters-node"
import type {
  LogChunk,
  OutList,
  RunInputFileDetail,
  SummaryResponse,
} from "@workspace/contracts"

const CHUNK_BYTES = 64 * 1024

export function resolveAttemptRoot(
  engine: Host,
  runId: string,
  taskId: string,
  attempt: number
): string | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  if (!state.tasks[taskId]) return null
  const step = state.steps.steps[taskId]?.at(-1)
  if (!step || step.attempts < attempt) return null
  const root = runDir(workflowDir(engine.home, state.workflowId), runId)
  return attemptRootOf(stepDir(root, taskId, step.pass), attempt)
}

export function readLogChunk(
  attemptRoot: string,
  stream: LogChunk["stream"],
  offset: number
): LogChunk {
  const path = join(attemptRoot, `${stream}.log`)
  if (!existsSync(path)) {
    return { stream, offset, nextOffset: offset, text: "", eof: true }
  }
  const size = statSync(path).size
  if (offset >= size) {
    return { stream, offset, nextOffset: offset, text: "", eof: true }
  }
  const length = Math.min(CHUNK_BYTES, size - offset)
  const fd = openSync(path, "r")
  try {
    const buf = Buffer.alloc(length)
    readSync(fd, buf, 0, length, offset)
    const nextOffset = offset + length
    return {
      stream,
      offset,
      nextOffset,
      text: buf.toString("utf8"),
      eof: nextOffset >= size,
    }
  } finally {
    closeSync(fd)
  }
}

export function readSummary(attemptRoot: string): SummaryResponse {
  const path = join(attemptRoot, "SUMMARY.md")
  if (!existsSync(path)) return { text: null, missing: true }
  return { text: readFileSync(path, "utf8"), missing: false }
}

export function listOutFiles(attemptRoot: string): OutList {
  const outRoot = join(attemptRoot, "out")
  if (!existsSync(outRoot)) return { files: [] }

  const files: OutList["files"] = []
  const walk = (rel: string, abs: string) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        files.push({ path: relPath, type: "dir" })
        walk(relPath, join(abs, ent.name))
      } else if (ent.isFile()) {
        files.push({ path: relPath, type: "file" })
      }
    }
  }
  walk("", outRoot)
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files }
}

/** Resolve a path under attempt out/; null if missing or escapes. */
export function resolveOutPath(
  attemptRoot: string,
  rel: string
): string | null {
  if (!rel || rel.includes("\0") || rel.split("/").includes("..")) return null
  const absRoot = resolve(attemptRoot, "out")
  const full = resolve(absRoot, ...rel.split("/"))
  if (full !== absRoot && !full.startsWith(absRoot + sep)) return null
  return full
}

export function readOutTextFile(
  attemptRoot: string,
  rel: string
): RunInputFileDetail | null {
  const path = resolveOutPath(attemptRoot, rel)
  if (!path || !existsSync(path) || !statSync(path).isFile()) return null
  return { path: rel, content: readFileSync(path, "utf8") }
}
