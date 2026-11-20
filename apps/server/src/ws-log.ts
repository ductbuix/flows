import type { Engine } from "@workspace/engine"
import { readLogChunk, resolveAttemptRoot } from "./run-files.ts"

export type LogSub = {
  key: string
  runId: string
  taskId: string
  attempt: number
  stream: "stdout" | "stderr"
  offset: number
  timer: ReturnType<typeof setInterval>
}

export function logSubKey(
  runId: string,
  taskId: string,
  attempt: number,
  stream: string
): string {
  return `${runId}:${taskId}:${attempt}:${stream}`
}

export function startLogSubscription(
  engine: Engine,
  send: (data: string) => void,
  sub: Omit<LogSub, "timer" | "key">
): LogSub | null {
  const attemptRoot = resolveAttemptRoot(
    engine,
    sub.runId,
    sub.taskId,
    sub.attempt
  )
  if (!attemptRoot) return null

  const key = logSubKey(sub.runId, sub.taskId, sub.attempt, sub.stream)
  const live = { ...sub, key, offset: sub.offset }

  const timer = setInterval(() => {
    const root = resolveAttemptRoot(engine, sub.runId, sub.taskId, sub.attempt)
    if (!root) return
    const chunk = readLogChunk(root, sub.stream, live.offset)
    if (chunk.text.length === 0 && !chunk.eof) return
    live.offset = chunk.nextOffset
    send(
      JSON.stringify({
        type: "log_chunk",
        runId: sub.runId,
        taskId: sub.taskId,
        attempt: sub.attempt,
        chunk,
      })
    )
  }, 300)

  const chunk = readLogChunk(attemptRoot, sub.stream, live.offset)
  if (chunk.text.length > 0 || chunk.eof) {
    live.offset = chunk.nextOffset
    send(
      JSON.stringify({
        type: "log_chunk",
        runId: sub.runId,
        taskId: sub.taskId,
        attempt: sub.attempt,
        chunk,
      })
    )
  }
  return { ...live, timer }
}
