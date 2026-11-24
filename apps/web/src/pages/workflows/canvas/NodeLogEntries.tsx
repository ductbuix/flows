import { MessageSquareIcon, WrenchIcon } from "lucide-react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Terminal } from "@workspace/ui/components/terminal"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@workspace/ui/components/trace"
import { StackTrace } from "@workspace/ui/components/stack-trace"
import { cn } from "@workspace/ui/lib/utils"
import { formatAbsolute } from "@/lib/labels"
import { mono } from "@/components/data/mono"
import { parseTrace, type LogEntry } from "./node-logs"

export function Output({ text, testId }: { text: string; testId?: string }) {
  return (
    <pre
      className={cn(
        "max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap",
        mono
      )}
      data-testid={testId}
    >
      {text}
    </pre>
  )
}

/** Placeholder rows in the shape of log entries while logs load. */
export function NodeLogLoading() {
  return (
    <ol className="flex flex-col gap-2" data-testid="node-log-loading">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex flex-col gap-1">
          <Skeleton className="ml-1 h-3 w-24" />
          <Skeleton className="h-12 w-full" />
        </li>
      ))}
    </ol>
  )
}

/** Ordered list of one attempt's entries: commands, tools, messages, errors. */
export function NodeLogEntries({ entries }: { entries: LogEntry[] }) {
  return (
    <ol className="flex flex-col gap-2" data-testid="node-log-entries">
      {entries.map((e, i) => (
        <EntryRow key={`${e.at}-${i}`} entry={e} />
      ))}
    </ol>
  )
}

/** Terminal status for the AI Elements Terminal pattern. */
function termStatus(status?: string): "running" | "error" | undefined {
  if (status === "failed") return "error"
  if (
    status === "running" ||
    status === "in_progress" ||
    status === "pending"
  ) {
    return "running"
  }
  return undefined
}

/** One command, tool call or reply with its time and result. */
function EntryRow({ entry }: { entry: LogEntry }) {
  return (
    <li
      className="flex flex-col gap-1"
      data-testid={`node-log-entry-${entry.kind}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 px-1 text-xs text-muted-foreground">
        <time dateTime={entry.at}>{formatAbsolute(entry.at)}</time>
        {entry.status ? <span>{entry.status}</span> : null}
      </div>
      <EntryBody entry={entry} />
    </li>
  )
}

function EntryBody({ entry }: { entry: LogEntry }) {
  const text = entry.text ?? ""
  if (entry.kind === "error" && text) {
    const trace = parseTrace(text)
    return (
      <StackTrace
        error={trace.error}
        frames={trace.frames}
        data-testid="node-log-trace"
      />
    )
  }
  if (entry.command) {
    return (
      <Terminal
        title={entry.command}
        output={text || "(no output)"}
        status={termStatus(entry.status)}
        defaultOpen
        data-testid="node-log-terminal"
      />
    )
  }
  const Icon = entry.kind === "message" ? MessageSquareIcon : WrenchIcon
  const status = termStatus(entry.status)
  return (
    <Trace data-testid="node-log-tool">
      <TraceCollapsible defaultOpen={entry.kind === "message"}>
        <TraceCollapsibleTrigger>
          <TraceLine status={status === "running" ? undefined : status}>
            <TraceIcon>
              <Icon />
            </TraceIcon>
            <TraceTitle>{entry.title}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        {text.trim() ? (
          <TraceCollapsibleContent>
            <Output text={text} />
          </TraceCollapsibleContent>
        ) : null}
      </TraceCollapsible>
    </Trace>
  )
}
