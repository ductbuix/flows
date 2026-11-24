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
import { Button } from "@workspace/ui/components/button"
import { StackTrace } from "@workspace/ui/components/stack-trace"
import type { CanvasNode } from "./flow-graph"
import { parseEntries, parseTrace, type LogEntry } from "./node-logs"
import { NodeLogEntries, Output } from "./NodeLogEntries"

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
  passes: { pass: number; attempts: number }[]
  failReason?: string
  onClose: () => void
}

/** Full stdout/stderr of one node attempt, errors as a stack trace. */
export function NodeLogDialog({
  runId,
  nodeId,
  nodeName,
  passes,
  failReason,
  onClose,
}: Props) {
  const client = useFlowsClient()
  const latest = passes.at(-1) ?? { pass: 1, attempts: 1 }
  const [picked, setPicked] = useState<number | null>(null)
  const pass = picked ?? latest.pass
  const attempt = passes.find((p) => p.pass === pass)?.attempts ?? 1
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
          pass,
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
  }, [client, runId, nodeId, pass, attempt])

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
          <DialogDescription>
            {passes.length > 1 ? `Pass ${pass} · ` : ""}Attempt {attempt}
          </DialogDescription>
        </DialogHeader>
        {passes.length > 1 ? (
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label="Pass"
            data-testid="node-log-passes"
          >
            {passes.map((p) => (
              <Button
                key={p.pass}
                role="tab"
                aria-selected={p.pass === pass}
                variant={p.pass === pass ? "secondary" : "ghost"}
                data-testid={`node-log-pass-${p.pass}`}
                onClick={() => {
                  setState({ status: "loading" })
                  setPicked(p.pass)
                }}
              >
                Pass {p.pass}
              </Button>
            ))}
          </div>
        ) : null}
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
            <NodeLogEntries entries={logs.entries} />
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

/** Log dialog for the canvas node whose logs are open. */
export function CanvasNodeLogs({
  runId,
  node,
  onClose,
}: {
  runId: string
  node: CanvasNode
  onClose: () => void
}) {
  const { data } = node
  return (
    <NodeLogDialog
      runId={runId}
      nodeId={node.id}
      nodeName={data.name ?? data.kind}
      passes={
        data.passes ?? [{ pass: data.pass ?? 1, attempts: data.attempt ?? 1 }]
      }
      failReason={data.failReason}
      onClose={onClose}
    />
  )
}
