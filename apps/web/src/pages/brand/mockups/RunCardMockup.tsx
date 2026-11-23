import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Trace,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@workspace/ui/components/trace"
import { CircleCheck, CircleDot, GitFork, ScanSearch } from "lucide-react"
import { Task } from "@/components/ai-elements/task"
import { KindAvatar } from "@/components/brand/KindAvatar"
import { StatRow } from "@/components/brand/StatRow"
import { StatusPill } from "@/components/brand/StatusPill"
import type { Mockup } from "../types"
import { ANSWER, DONE, RUNNING } from "./run-card-data"

/** A run of a workflow with parallel branches, live and finished. */
export function RunCardMockup() {
  const [done, setDone] = useState(false)
  const branches = done ? DONE : RUNNING
  return (
    <Card className="w-full max-w-xl bg-muted" data-testid="mockup-run-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <KindAvatar kind="solid" size="lg">
            <ScanSearch />
          </KindAvatar>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Release check</CardTitle>
            <CardDescription>3 agents in parallel</CardDescription>
          </div>
        </div>
        <CardAction>
          {done ? (
            <StatusPill tone="done">Done</StatusPill>
          ) : (
            <StatusPill tone="working">3 working</StatusPill>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Trace>
              <TraceLine className="text-foreground">
                <TraceIcon>
                  <CircleDot />
                </TraceIcon>
                <TraceTitle>Is release 2.4 ready to ship?</TraceTitle>
              </TraceLine>
              <TraceLine>
                <TraceIcon>
                  <GitFork />
                </TraceIcon>
                <TraceTitle>Split into 3 parallel steps</TraceTitle>
              </TraceLine>
              {branches.map((b) => (
                <Task
                  key={`${b.title}-${done}`}
                  title={b.title}
                  status={b.status}
                  description={b.duration}
                  steps={b.steps}
                  defaultOpen
                />
              ))}
            </Trace>
            {done ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <CircleCheck className="size-4 text-success" />
                  Answer
                </div>
                <p>Ship after two fixes:</p>
                <ol className="flex list-decimal flex-col gap-1.5 pl-5">
                  {ANSWER.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="justify-between gap-4 bg-muted">
        <StatRow
          stats={[
            { label: "Time", value: done ? "11.9s" : "4.4s" },
            { label: "Sources", value: done ? "15" : "8" },
            { label: "Tokens", value: done ? "17.6k" : "8.0k" },
          ]}
        />
        <Button size="pill" onClick={() => setDone((d) => !d)}>
          {done ? "Run again" : "Stop"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export const runCardMockup: Mockup = {
  id: "run-card",
  title: "Run card",
  group: "Workflows",
  summary:
    "A workflow run as a trace: question, split, parallel steps, answer, stats.",
  usedIn: ["Workflow page Runs tab", "Work item detail"],
  anatomy: [
    "Card (bg-muted) > CardHeader: KindAvatar solid, CardTitle, CardDescription, CardAction status pill",
    "Inner Card: Trace with the input line and the split line",
    "One AI Elements Task per branch: title, duration (TraceDescription), steps",
    "Answer: check, heading, numbered points",
    "CardFooter: StatRow (Time, Sources, Tokens) and one pill action",
  ],
  states: [
    "Running: spinner icons and shimmering titles (TraceLine status=running)",
    "Step error: TraceLine status=error turns the line red; the run keeps going",
    "Done: check icons; each Task holds one result line; the chevron folds it",
  ],
  rules: {
    do: [
      "Use Task / Trace for any list of agent steps; never draw connectors",
      "Show the live action as a verb phrase: Searching 4 repositories",
      "Keep one primary action in the footer: Stop while running",
    ],
    dont: [
      "Log lines or raw ids in the trace",
      "Custom spinners, elbows or tree lines",
      "More than one filled button",
    ],
  },
  parts: [
    "ui Card (Header, Title, Description, Action, Content, Footer)",
    "ai-elements Task, ui Trace",
    "ui Avatar via components/brand/KindAvatar",
    "components/brand/StatusPill, StatRow; ui Button size=pill",
  ],
  Component: RunCardMockup,
}
