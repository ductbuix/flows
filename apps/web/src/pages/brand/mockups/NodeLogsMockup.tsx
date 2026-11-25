import type { ReactNode } from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { StackTrace } from "@workspace/ui/components/stack-trace"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"
import {
  NodeLogEntries,
  NodeLogLoading,
  Output,
} from "@/pages/workflows/canvas/NodeLogEntries"
import type { Mockup } from "../types"
import { ENTRIES, FAILURE, STDOUT } from "./node-logs-data"

/** One log sheet state. The real one opens in a right Sheet. */
function LogPanel({
  id,
  tone,
  pill,
  children,
}: {
  id: string
  tone: Tone
  pill: string
  children: ReactNode
}) {
  return (
    <Card size="sm" className="min-w-0" data-testid={`node-logs-${id}`}>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Build logs</CardTitle>
          <CardDescription>Attempt 2</CardDescription>
        </div>
        <CardAction>
          <StatusPill tone={tone}>{pill}</StatusPill>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

/** Logs behind the node's Logs button: loading, entries, failed, empty. */
export function NodeLogsMockup() {
  return (
    <div
      className="grid w-full max-w-4xl gap-4 md:grid-cols-2"
      data-testid="mockup-node-logs"
    >
      <LogPanel id="loading" tone="working" pill="Loading">
        <NodeLogLoading />
      </LogPanel>
      <LogPanel id="entries" tone="done" pill="3 steps">
        <NodeLogEntries entries={ENTRIES} />
      </LogPanel>
      <LogPanel id="failed" tone="failed" pill="Failed">
        <StackTrace
          error={FAILURE.error}
          frames={FAILURE.frames}
          data-testid="node-log-trace"
        />
        <Output text={STDOUT} />
      </LogPanel>
      <LogPanel id="empty" tone="idle" pill="No output">
        <p className="text-muted-foreground">No output yet.</p>
      </LogPanel>
    </div>
  )
}

export const nodeLogsMockup: Mockup = {
  id: "node-logs",
  title: "Node logs",
  group: "Workflows",
  summary:
    "Logs of one node attempt, behind the node's Logs button in a right Sheet.",
  usedIn: ["Workflow run view, node Logs button"],
  anatomy: [
    "Sheet (right): title = node name logs, description = Pass n and Attempt n",
    "Pass chips when a node ran more than once (tabs; the latest is picked)",
    "Ordered entries: Terminal for commands, Trace for tool calls and replies, StackTrace for errors",
    "Stdout in Output when there are no entries; failure reason as StackTrace",
  ],
  states: [
    "Loading: Skeleton rows in the shape of the entries",
    "Entries: one row per command, tool call, reply or error, with its time",
    "Failed: StackTrace headline and frames, then stdout",
    "Empty: one sentence, No output yet.",
  ],
  rules: {
    do: [
      "Open logs only from the node's Logs button, in a right Sheet",
      "Show the result on the node; logs stay one click away",
      "Fold long output inside its entry; show errors as a stack trace",
    ],
    dont: [
      "A log panel under the canvas or on the node itself",
      "Raw NDJSON, ids or paths in the entry list",
      "Custom spinners or terminals instead of the parts",
    ],
  },
  parts: [
    "ui Sheet (SheetHeader, SheetTitle, SheetDescription)",
    "ui Terminal, Trace (TraceCollapsible), StackTrace, Skeleton",
    "canvas NodeLogEntries (entries, loading, Output)",
    "components/brand/StatusPill",
  ],
  Component: NodeLogsMockup,
}
