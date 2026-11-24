import type { DocumentStore } from "../ports/document-store.ts"

/** One line of `attempt-N/events.log` (NDJSON), shown in the logs popup. */
export type LogEntry = {
  at: string
  kind: "command" | "tool_call" | "message" | "error"
  /** Tool name, or the shell line for a command. */
  title: string
  /** Command line a tool ran, when the tool input has one. */
  command?: string
  status?: string
  /** Result text: command output, tool result or error. */
  text?: string
}

const TEXT_MAX = 8_000

/** Append one entry to the attempt's activity log. */
export function appendLogEntry(
  docs: DocumentStore,
  attemptRoot: string,
  entry: Omit<LogEntry, "at"> & { at?: string }
): void {
  const path = `${attemptRoot}/events.log`
  const text =
    entry.text && entry.text.length > TEXT_MAX
      ? `${entry.text.slice(0, TEXT_MAX)}\n… truncated`
      : entry.text
  const line = JSON.stringify({
    ...entry,
    at: entry.at ?? new Date().toISOString(),
    ...(text !== undefined ? { text } : {}),
  })
  docs.write(path, `${docs.read(path)?.text ?? ""}${line}\n`)
}
