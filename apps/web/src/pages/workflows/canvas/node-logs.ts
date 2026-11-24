import type { NodeKindName, RunState } from "./flow-kinds"

/** Kinds that run a process on this machine (shell or agent CLI). */
const LOCAL_PROCESS: ReadonlySet<NodeKindName> = new Set([
  "command",
  "llm",
  "agent",
])

/** Logs button rule: a process kind that has started in the followed run. */
export function showsLogButton(
  kind: NodeKindName,
  state: RunState | undefined
): boolean {
  if (!LOCAL_PROCESS.has(kind)) return false
  return state === "running" || state === "done" || state === "failed"
}

const FRAME = /^\s+at\s/

/** Split error text into a headline and stack frames for StackTrace. */
export function parseTrace(text: string): { error: string; frames: string[] } {
  const lines = text.split("\n")
  const frames = lines.filter((l) => FRAME.test(l)).map((l) => l.trim())
  const error =
    lines
      .filter((l) => !FRAME.test(l) && l.trim())
      .join("\n")
      .trim() || text.trim()
  return { error, frames }
}

export type LogEntry = {
  at: string
  kind: "command" | "tool_call" | "message" | "error"
  title: string
  /** The command line that ran, when the entry has one. */
  command?: string
  status?: string
  text?: string
}

/** Parse `events.log` NDJSON; newest first, bad lines dropped. */
export function parseEntries(ndjson: string): LogEntry[] {
  const out: { entry: LogEntry; i: number }[] = []
  ndjson.split("\n").forEach((line, i) => {
    if (!line.trim()) return
    try {
      const e = JSON.parse(line) as LogEntry
      if (typeof e.at === "string" && typeof e.title === "string") {
        out.push({ entry: e, i })
      }
    } catch {
      // partial line while the attempt is still writing
    }
  })
  out.sort((a, b) =>
    a.entry.at === b.entry.at ? b.i - a.i : a.entry.at < b.entry.at ? 1 : -1
  )
  return out.map((o) => o.entry)
}
