import type { Tone } from "@/components/brand/StatusPill"

export type BoardCard = {
  title: string
  source: string
  workflow?: string
  status?: { tone: Tone; label: string }
}

export type BoardColumn = { title: string; cards: BoardCard[] }

/** Sample board for the kanban mockup. */
export const COLUMNS: BoardColumn[] = [
  {
    title: "Inbox",
    cards: [
      { title: "Fix flaky login test", source: "Rally US1234 · 2h ago" },
      { title: "Summarize Q4 support tickets", source: "Ad hoc · yesterday" },
    ],
  },
  {
    title: "Running",
    cards: [
      {
        title: "Release 2.4 readiness",
        source: "Rally US1201 · 10m ago",
        workflow: "Release check",
        status: { tone: "working", label: "Step 2 of 4" },
      },
      {
        title: "Update onboarding docs",
        source: "Library · 1h ago",
        workflow: "Docs refresh",
        status: { tone: "failed", label: "Failed" },
      },
    ],
  },
  {
    title: "Needs you",
    cards: [
      {
        title: "Publish API changelog",
        source: "Ad hoc · 30m ago",
        workflow: "Changelog",
        status: { tone: "attention", label: "Approve publish" },
      },
      {
        title: "Weekly analytics digest",
        source: "Schedule · today",
        workflow: "Digest",
        status: { tone: "attention", label: "Needs sign-in" },
      },
    ],
  },
  {
    title: "Done",
    cards: [
      {
        title: "Triage open bugs",
        source: "Rally US1188 · Mon",
        workflow: "Bug triage",
        status: { tone: "done", label: "Done" },
      },
    ],
  },
]
