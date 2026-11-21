import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve, sep } from "node:path"
import {
  runDir,
  runInputDir,
  workflowDir,
  type Engine,
} from "@workspace/engine"
import type { InputsJson, OutList, RunInputFileDetail } from "@workspace/shared"
import { inputsJsonSchema } from "@workspace/shared"

function runInputRoot(engine: Engine, runId: string): string | null {
  const state = engine.fold(runId)
  if (!state || state.deleted) return null
  const wfRoot = workflowDir(engine.home, state.workflowId)
  return runInputDir(runDir(wfRoot, runId))
}

/** Resolve a path under the run input dir; null if missing or escapes. */
export function resolveRunInputPath(
  engine: Engine,
  runId: string,
  rel: string
): string | null {
  if (!rel || rel.includes("\0") || rel.split("/").includes("..")) return null
  const root = runInputRoot(engine, runId)
  if (!root) return null
  const absRoot = resolve(root)
  const full = resolve(absRoot, ...rel.split("/"))
  if (full !== absRoot && !full.startsWith(absRoot + sep)) return null
  return full
}

export function listRunInputFiles(
  engine: Engine,
  runId: string
): OutList | null {
  const root = runInputRoot(engine, runId)
  if (!root) return null
  if (!existsSync(root)) return { files: [] }

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
  walk("", root)
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files }
}

export function readRunInputsJson(
  engine: Engine,
  runId: string
): InputsJson | null {
  const path = resolveRunInputPath(engine, runId, "inputs.json")
  if (!path || !existsSync(path)) return null
  try {
    return inputsJsonSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return null
  }
}

export function readRunInputTextFile(
  engine: Engine,
  runId: string,
  rel: string
): RunInputFileDetail | null {
  const path = resolveRunInputPath(engine, runId, rel)
  if (!path || !existsSync(path) || !statSync(path).isFile()) return null
  return { path: rel, content: readFileSync(path, "utf8") }
}

export function readRunInputBytes(
  engine: Engine,
  runId: string,
  rel: string
): { path: string; data: Buffer } | null {
  const path = resolveRunInputPath(engine, runId, rel)
  if (!path || !existsSync(path) || !statSync(path).isFile()) return null
  return { path: rel, data: readFileSync(path) }
}
