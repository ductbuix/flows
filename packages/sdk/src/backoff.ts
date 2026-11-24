export type BackoffOptions = {
  /** First delay after a drop. Default 250. */
  readonly initialMs?: number
  /** Cap for exponential growth. Default 30_000. */
  readonly maxMs?: number
}

const DEFAULT_INITIAL_MS = 250
const DEFAULT_MAX_MS = 30_000

export function createBackoff(options?: BackoffOptions): {
  nextDelayMs: () => number
  reset: () => void
} {
  const initialMs = options?.initialMs ?? DEFAULT_INITIAL_MS
  const maxMs = options?.maxMs ?? DEFAULT_MAX_MS
  let attempt = 0

  return {
    nextDelayMs() {
      const delay = Math.min(initialMs * 2 ** attempt, maxMs)
      attempt += 1
      return delay
    },
    reset() {
      attempt = 0
    },
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new Error("aborted"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
