import { COALESCE_CHUNK_KINDS, type AgentRunUpdate } from "./agent-update.ts"

export const COALESCE_WINDOW_MS = 50

export type ScheduleFn = (cb: () => void, ms: number) => () => void

export type RunUpdateCoalescer = {
  /** Queue one update; chunk kinds merge within the window. */
  push(update: AgentRunUpdate): void
  /** Flush pending chunks for one run, or all when omitted. */
  flush(runId?: string): void
  dispose(): void
}

export type RunUpdateCoalescerOptions = {
  publish: (update: AgentRunUpdate) => void
  /** Defaults to `setTimeout`. Inject for tests. */
  schedule?: ScheduleFn
  windowMs?: number
}

type PendingChunk = {
  update: AgentRunUpdate
  cancel: () => void
}

function chunkKey(update: AgentRunUpdate): string {
  return `${update.runId}\0${update.stepId}\0${update.kind}`
}

function defaultSchedule(cb: () => void, ms: number): () => void {
  const id = setTimeout(cb, ms)
  return () => clearTimeout(id)
}

/**
 * Merge `agent_message_chunk` / `agent_thought_chunk` per run per 50 ms.
 * Tool calls, plans and other kinds flush pending chunks then publish
 * immediately so they are never dropped (DES-040, BL-141).
 */
export function createRunUpdateCoalescer(
  options: RunUpdateCoalescerOptions
): RunUpdateCoalescer {
  const schedule = options.schedule ?? defaultSchedule
  const windowMs = options.windowMs ?? COALESCE_WINDOW_MS
  const pending = new Map<string, PendingChunk>()

  const publishPending = (key: string) => {
    const entry = pending.get(key)
    if (!entry) return
    pending.delete(key)
    entry.cancel()
    options.publish(entry.update)
  }

  const flushRun = (runId: string) => {
    for (const key of [...pending.keys()]) {
      if (key.startsWith(`${runId}\0`)) publishPending(key)
    }
  }

  return {
    push(update) {
      if (!COALESCE_CHUNK_KINDS.has(update.kind)) {
        flushRun(update.runId)
        options.publish(update)
        return
      }

      const key = chunkKey(update)
      const text =
        typeof update.text === "string"
          ? update.text
          : String(update.text ?? "")
      const existing = pending.get(key)
      if (existing) {
        const prev =
          typeof existing.update.text === "string"
            ? existing.update.text
            : String(existing.update.text ?? "")
        existing.update = { ...existing.update, text: prev + text }
        return
      }

      const cancel = schedule(() => publishPending(key), windowMs)
      pending.set(key, {
        update: { ...update, text },
        cancel,
      })
    },

    flush(runId) {
      if (runId !== undefined) {
        flushRun(runId)
        return
      }
      for (const key of [...pending.keys()]) publishPending(key)
    },

    dispose() {
      for (const entry of pending.values()) entry.cancel()
      pending.clear()
    },
  }
}
