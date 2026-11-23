/** Mock Docket data shaped like DES-038 (board.yaml + card.md). */

export type Tone = "idle" | "working" | "attention" | "done"
export type Column = {
  id: string
  label: string
  tone: Tone
  done?: boolean
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "2026-11-28" -> "Nov 28, 2026" (no Date API, so no timezone surprises). */
export function formatDate(iso: string): string {
  const [y, m, day] = iso.split("-")
  return `${MONTHS[Number(m) - 1]} ${Number(day)}, ${y}`
}
export type Ref = {
  system: string
  id?: string
  url?: string
  label: string
  syncedAgo?: string
  /** Snapshot of the external item (read only, written by a connector). */
  data?: Record<string, string>
}
export type Asset = {
  path: string
  label?: string
  scope: "owned" | "linked"
  missing?: boolean
}
export type CardLink = { to: string; rel: string }
export type Card = {
  id: string
  title: string
  status: string
  due?: string
  start?: string
  created: string
  updated: string
  refs: Ref[]
  assets: Asset[]
  links: CardLink[]
  fields: Record<string, string>
  body: string
}

/** Fixed "today" so mock data is stable. */
export const MOCK_TODAY = "2026-11-23"

export const COLUMNS: Column[] = [
  { id: "todo", label: "Todo", tone: "idle" },
  { id: "doing", label: "Doing", tone: "working" },
  { id: "review", label: "Review", tone: "attention" },
  { id: "done", label: "Done", tone: "done", done: true },
]

export const CARDS: Card[] = [
  {
    id: "fix-flaky-login",
    title: "Fix flaky login test",
    status: "doing",
    start: "2026-11-20",
    due: "2026-11-28",
    created: "2026-11-20",
    updated: "2026-11-23",
    refs: [
      {
        system: "rally",
        id: "US1234",
        label: "Login flake on CI",
        syncedAgo: "5 min ago",
        data: {
          State: "In progress",
          Iteration: "Sprint 42",
          Owner: "Dana Kim",
          Points: "3",
          Priority: "High",
          Blocked: "No",
        },
      },
    ],
    assets: [
      {
        path: "assets/rally-US1234.json",
        label: "Rally snapshot",
        scope: "owned",
      },
      {
        path: "assets/acceptance.md",
        label: "Acceptance criteria",
        scope: "owned",
      },
      {
        path: "/Users/me/Screens/flake.png",
        label: "Failure screenshot",
        scope: "linked",
      },
    ],
    links: [{ to: "refactor-auth-session", rel: "blocks" }],
    fields: { assignee: "dbx", "x-rally.iteration": "Sprint 42" },
    body: "Login test fails about 1 run in 5 on CI. Suspect a race between the session cookie and the redirect.\n\nAgent notes: reproduced locally with `--repeat-each=20`.",
  },
  {
    id: "refactor-auth-session",
    title: "Refactor auth session handling",
    status: "todo",
    due: "2026-12-05",
    created: "2026-11-18",
    updated: "2026-11-22",
    refs: [
      {
        system: "github",
        id: "#482",
        label: "Auth session cleanup",
        syncedAgo: "1 hour ago",
        data: { State: "Open", Milestone: "v0.4", Labels: "refactor, auth" },
      },
    ],
    assets: [],
    links: [],
    fields: { assignee: "dbx" },
    body: "Move cookie handling into one module.",
  },
  {
    id: "release-notes-v0-4",
    title:
      "Draft release notes for v0.4 including the migration guide, breaking changes and upgrade checklist",
    status: "todo",
    created: "2026-11-21",
    updated: "2026-11-21",
    refs: [],
    assets: [{ path: "assets/changelog.md", scope: "owned" }],
    links: [],
    fields: {},
    body: "",
  },
  {
    id: "confluence-onboarding",
    title: "Onboarding page review",
    status: "review",
    due: "2026-11-25",
    created: "2026-11-15",
    updated: "2026-11-23",
    refs: [
      {
        system: "confluence",
        id: "48213",
        label: "Onboarding guide",
        syncedAgo: "2 days ago",
        data: { Space: "ENG", Version: "12", "Last editor": "Sam Lee" },
      },
    ],
    assets: [
      { path: "/Users/me/Docs/old-guide.md", scope: "linked", missing: true },
    ],
    links: [{ to: "fix-flaky-login", rel: "relates" }],
    fields: { assignee: "sam" },
    body: "Check the setup steps against the current CLI.",
  },
  {
    id: "rally-story-sync",
    title: "Rally story sync spike",
    status: "done",
    created: "2026-11-10",
    updated: "2026-11-19",
    refs: [{ system: "rally", id: "US1190", label: "Sync stories into cards" }],
    assets: [],
    links: [],
    fields: {},
    body: "Done: connector writes the snapshot asset.",
  },
]
