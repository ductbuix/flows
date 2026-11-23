/** Mock contents and metadata of the workspace files; nothing is read from disk. */

const TEXT: Record<string, string> = {
  "config.yaml": "library:\n  maxBytes: 52428800\nagents:\n  maxParallel: 3\n",
  "mcp-trust.json": '{\n  "allowed": ["rally", "confluence"],\n  "denied": []\n}\n',
  "docket/board.yaml":
    "version: 1\ncolumns:\n  - { id: todo, label: Todo }\n  - { id: doing, label: Doing }\n  - { id: review, label: Review }\n  - { id: done, label: Done, done: true }\nface: [due, fields.assignee]\n",
  "docket/cards/fix-flaky-login/card.md":
    "---\nid: fix-flaky-login\ntitle: Fix flaky login test\nstatus: doing\ndue: 2026-11-28\nrefs:\n  - system: rally\n    id: US1234\n---\n\nThe login test fails about one run in five on CI.\n",
  "docket/cards/fix-flaky-login/assets/rally-US1234.json":
    '{\n  "id": "US1234",\n  "name": "Login flake on CI",\n  "state": "In Progress",\n  "iteration": "Sprint 42"\n}\n',
  "docket/cards/fix-flaky-login/assets/acceptance.md":
    "# Acceptance criteria\n\n- The login spec passes 50 runs in a row.\n- No sleeps added to the test.\n",
  "workflows/review-pr/workflow.yaml":
    "id: review-pr\ntrigger: manual\nnodes:\n  - id: plan\n    kind: llm\n  - id: review\n    kind: llm\n",
  "workflows/review-pr/nodes/plan.md": "Read the diff and plan the review.\n",
  "workitems/us123456/item.yaml": "id: us123456\ntitle: Sample work item\nsource: rally\n",
  "workitems/us123456/notes.md": "# Notes\n\nOpen question: which test is flaky?\n",
}

export type FileMeta = {
  kind: string
  size: string
  modified: string
  binary: boolean
}

const KIND: Record<string, string> = {
  yaml: "YAML",
  json: "JSON",
  md: "Markdown",
  db: "SQLite database",
}

export function metaOf(path: string): FileMeta {
  const ext = path.split(".").pop() ?? ""
  const bytes = path === "app.db" ? 2_400_000 : (TEXT[path]?.length ?? 120 + path.length * 11)
  const size = bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : bytes > 1000 ? `${(bytes / 1000).toFixed(1)} KB` : `${bytes} B`
  return {
    kind: KIND[ext] ?? "File",
    size,
    modified: path.startsWith("docket") ? "Nov 23, 2026" : "Nov 20, 2026",
    binary: ext === "db",
  }
}

export function contentOf(path: string): string {
  if (path in TEXT) return TEXT[path]!
  if (path.endsWith(".gitkeep")) return ""
  const name = path.split("/").pop()
  return `# ${name}\n\n(Mock content. The real file is read from disk.)\n`
}
