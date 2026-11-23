import type { Mockup } from "../types"
import { StatusPill, type Tone } from "@/components/brand/StatusPill"

const EXAMPLES: { tone: Tone; label: string }[] = [
  { tone: "working", label: "3 working" },
  { tone: "done", label: "Done" },
  { tone: "failed", label: "Failed" },
  { tone: "attention", label: "Needs sign-in" },
  { tone: "idle", label: "Queued" },
]

/** Every status tone with a typical label. */
export function StatusMockup() {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="mockup-status">
      {EXAMPLES.map((ex) => (
        <StatusPill key={ex.tone} tone={ex.tone} data-testid={`pill-${ex.tone}`}>
          {ex.label}
        </StatusPill>
      ))}
    </div>
  )
}

export const statusMockup: Mockup = {
  id: "status",
  title: "Status pill",
  group: "Foundations",
  summary: "One tinted pill tells the state of a run, step or connection.",
  usedIn: ["Kanban card", "Run card header", "Workflow detail panel"],
  anatomy: ["Icon or pulse dot", "Sentence-case label (1–3 words)"],
  states: [
    "working: info tone, pulsing dot, count when useful (3 working)",
    "done: success tone, check",
    "failed: destructive tone, cross",
    "attention: warning icon on neutral text (Needs sign-in, Needs you)",
    "idle: muted (Queued, Draft, Off)",
  ],
  rules: {
    do: [
      "Use StatusPill; tones come from TONE_CLASS only",
      "Say what is true now in plain words: Done, Failed, Needs sign-in",
      "Put it at the right end of a header or row",
    ],
    dont: [
      "Raw enum labels (succeeded, cancelled) in the UI",
      "Two pills on one row",
      "Palette colors (text-green-600); use success / info / warning",
    ],
  },
  parts: ["components/brand/StatusPill", "ui Badge"],
  Component: StatusMockup,
}
