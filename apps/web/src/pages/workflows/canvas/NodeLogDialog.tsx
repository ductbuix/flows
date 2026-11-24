import { useEffect, useState } from "react"
import type { LogChunk } from "@workspace/contracts"
import { useFlowsClient } from "@workspace/sdk-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { MessageSquareIcon, WrenchIcon } from "lucide-react"
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
import { parseEntries, parseTrace, type LogEntry } from "./node-logs"

const MAX_CHUNKS = 16

type Logs = { stdout: string; stderr: string; entries: LogEntry[] }
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; logs: Logs }

type Props = {
  runId: string
  nodeId: string
  nodeName: string
  attempt: number
  failReason?: string
  onClose: () => void
}

/** Full stdout/stderr of one node attempt, errors as a stack trace. */
export function NodeLogDialog({
  runId,
  nodeId,
  nodeName,
  attempt,
  failReason,
  onClose,
}: Props) {
  const client = useFlowsClient()
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let alive = true
    async function read(stream: LogChunk["stream"]): Promise<string> {
      let text = ""
      let offset = 0
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const chunk: LogChunk = await client.call("run/get_log", {
          runId,
          stepId: nodeId,
          attempt,
          stream,
          offset,
        })
        text += chunk.text
        offset = chunk.nextOffset
        if (chunk.eof) break
      }
      return text
    }
    Promise.all([read("stdout"), read("stderr"), read("events")]).then(
      ([stdout, stderr, events]) => {
        if (alive) {
          setState({
            status: "ready",
            logs: { stdout, stderr, entries: parseEntries(events) },
          })
        }
      },
      (err: unknown) => {
        if (alive) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Logs unavailable",
          })
        }
      }
    )
    return () => {
      alive = false
    }
  }, [client, runId, nodeId, attempt])

  const logs = state.status === "ready" ? state.logs : null
  const errorText = logs?.stderr.trim() || failReason || ""
  const trace = errorText ? parseTrace(errorText) : null
  const empty =
    logs && logs.entries.length === 0 && !logs.stdout.trim() && !errorText

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-dvh flex-col gap-3 sm:max-w-xl"
        data-testid="node-log-dialog"
      >
        <DialogHeader>
          <DialogTitle>{nodeName} logs</DialogTitle>
          <DialogDescription>Attempt {attempt}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          {state.status === "loading" ? (
            <p className="text-muted-foreground">Loading logs…</p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-destructive" data-testid="node-log-error">
              {state.message}
            </p>
          ) : null}
          {logs && logs.entries.length > 0 ? (
            <ol className="flex flex-col gap-2" data-testid="node-log-entries">
              {logs.entries.map((e, i) => (
                <EntryRow key={`${e.at}-${i}`} entry={e} />
              ))}
            </ol>
          ) : (
            <>
              {trace ? (
                <StackTrace
                  error={trace.error}
                  frames={trace.frames}
                  data-testid="node-log-trace"
                />
              ) : null}
              {logs?.stdout.trim() ? (
                <Output text={logs.stdout} testId="node-log-stdout" />
              ) : null}
            </>
          )}
          {empty ? (
            <p className="text-muted-foreground" data-testid="node-log-empty">
              No output yet.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Output({ text, testId }: { text: string; testId?: string }) {
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
