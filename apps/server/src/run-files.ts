import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs"
import { join } from "node:path"
import { attemptDir, runDir, workflowDir, type Engine } from "@workspace/engine"
import type { LogChunk, OutList, SummaryResponse } from "@workspace/shared"

const CHUNK_BYTES = 64 * 1024

export function resolveAttemptRoot(
  engine: Engine,
  runId: string,
  taskId: string,
  attempt: number
): string | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  if (!state.tasks[taskId]) return null
  const hasAttempt = (state.tasks[taskId]?.attempts ?? []).some(
    (a) => a.attempt === attempt
  )
  if (!hasAttempt) return null
  const wfRoot = workflowDir(engine.home, state.workflowId)
  return attemptDir(runDir(wfRoot, runId), taskId, attempt)
}

export function readLogChunk(
  attemptRoot: string,
  stream: "stdout" | "stderr",
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
