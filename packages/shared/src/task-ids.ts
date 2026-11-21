/** Generated id shape: `task-` + eight hex chars (DES-020). */
export const GENERATED_TASK_ID_RE = /^task-[0-9a-f]{8}$/

/**
 * True when `id` is a single path segment (no `/`, `\`, or leading `.`).
 * Legacy ids such as `start` stay valid; only new ids use the pattern.
 * Leading `.` is rejected so `.trash` cannot be a task id (DES-022).
 */
export function isSafeTaskId(id: string): boolean {
  if (!id || id.startsWith(".")) return false
  if (id.includes("/") || id.includes("\\")) return false
  return true
}

/** First eight hex chars of a UUID v4 (DES-020). */
function uuidV4Prefix(): string {
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8)
}

/** Fresh `task-<8 hex>` id; retries when the candidate is in `existing`. */
export function newTaskId(existing?: Iterable<string>): string {
  const taken = existing ? new Set(existing) : null
  for (;;) {
    const id = `task-${uuidV4Prefix()}`
    if (!taken?.has(id)) return id
  }
}

/** Workflow-relative agent prompt path (DES-020). */
export function taskPromptPath(taskId: string): string {
  return `tasks/${taskId}/prompt.md`
}

export type JudgeSlot =
  { kind: "when" } | { kind: "until" } | { kind: "need"; needTaskId: string }

/** Workflow-relative agent judge path for a slot (DES-020). */
export function judgePromptPath(taskId: string, slot: JudgeSlot): string {
  if (slot.kind === "when") return `tasks/${taskId}/when.md`
  if (slot.kind === "until") return `tasks/${taskId}/until.md`
  return `tasks/${taskId}/need-${slot.needTaskId}.md`
}

/**
 * Env var name for an upstream task out dir: `UPSTREAM_` plus the id
 * with every `-` replaced by `_` (DES-020).
 */
export function upstreamEnvName(taskId: string): string {
  return `UPSTREAM_${taskId.replaceAll("-", "_")}`
}
