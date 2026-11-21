import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AgentTask } from "@workspace/shared"

/** Cursor stderr substrings → readable reason (DES-019). */
export const CURSOR_FAILURE_PATTERNS = [
  "Failed to create trust marker",
  "Failed to trust workspace",
  "Workspace Trust Required",
] as const

export type CliKind = AgentTask["cli"]

/** Map known CLI stderr patterns to a failure reason, else undefined. */
export function mapStderrReason(
  stderr: string,
  cli: CliKind | undefined
): string | undefined {
  if (!cli || cli !== "cursor") return undefined
  for (const pattern of CURSOR_FAILURE_PATTERNS) {
    if (stderr.includes(pattern)) return pattern
  }
  return undefined
}

/** Read attempt stderr.log; empty string if missing. */
export function readAttemptStderr(
  runRoot: string,
  taskId: string,
  attempt: number
): string {
  try {
    return readFileSync(
      join(runRoot, "tasks", taskId, `attempt-${attempt}`, "stderr.log"),
      "utf8"
    )
  } catch {
    return ""
  }
}

/**
 * Prefer a mapped CLI reason; else `timeout` when the attempt timed out.
 */
export function resolveFinishReason(options: {
  stderr: string
  cli: CliKind | undefined
  timedOut: boolean
}): string | undefined {
  const mapped = mapStderrReason(options.stderr, options.cli)
  if (mapped) return mapped
  if (options.timedOut) return "timeout"
  return undefined
}
