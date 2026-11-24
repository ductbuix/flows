import { pathsToFileTree } from "@workspace/ui/components/file-tree"

/** Nav + fixture paths for the app shell. */

export const APP_NAV = [
  { to: "/docket", label: "Docket", badge: "M" },
  { to: "/workflows", label: "Workflows", badge: "M" },
  { to: "/runs", label: "Runs", badge: "A" },
  { to: "/inbox", label: "Inbox", badge: "A" },
  { to: "/files", label: "Files", badge: "A" },
  { to: "/library", label: "Library", badge: "A" },
  { to: "/skills", label: "Skills", badge: "A" },
  { to: "/connectors", label: "Connectors", badge: "A" },
] as const

/** Mirrors the real app home (the whole folder, not a subset). */
export const FLOWAPP_PATHS = [
  "app.db",
  "mcp-trust.json",
  "config.yaml",
  "connections/rally-main/connection.yaml",
  "connections/github/connection.yaml",
  "connections/confluence/connection.yaml",
  "docket/board.yaml",
  "docket/cards/fix-flaky-login/card.md",
  "docket/cards/fix-flaky-login/assets/rally-US1234.json",
  "docket/cards/fix-flaky-login/assets/acceptance.md",
  "docket/cards/refactor-auth-session/card.md",
  "secrets/.gitkeep",
  "workflows/review-pr/workflow.yaml",
  "workflows/review-pr/nodes/plan.md",
  "workflows/review-pr/nodes/review.md",
  "workflows/review-pr/.cache/library.json",
  "workflows/release-notes/workflow.yaml",
  "workflows/release-notes/nodes/draft.md",
  "workitems/us123456/item.yaml",
  "workitems/us123456/notes.md",
]

export const FLOWAPP_ROOT = ".flowapp"
export const FLOWAPP_TREE = pathsToFileTree(FLOWAPP_PATHS)
