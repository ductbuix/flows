import type { DatabaseSync } from "node:sqlite"
import type { NoticeList } from "@workspace/contracts"

/**
 * In-app notices live in a table beside `events` and `settings` (BL-100).
 * They are app state, not run history: a run folder or log delete keeps
 * them, and reading or clearing them never touches a run.
 */
export type NewNotice = {
  /** Stable per step, so a repeated step posts once. */
  key: string
  title: string
  text: string
  runId: string
  workflowId: string
  nodeId: string
  at: string
  /** Not stored: only says how the host shows it when posted. */
  channel?: "app" | "system"
}

export function ensureNoticesTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      run_id TEXT NOT NULL,
      workflow_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      at TEXT NOT NULL,
      read_at TEXT
    );
  `)
}

/** True when the notice is new (a repeated step key posts nothing). */
export function postNotice(db: DatabaseSync, n: NewNotice): boolean {
  const r = db
    .prepare(
      `INSERT OR IGNORE INTO notices
       (key, run_id, workflow_id, node_id, title, text, at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(n.key, n.runId, n.workflowId, n.nodeId, n.title, n.text, n.at)
  return Number(r.changes) > 0
}

type Row = {
  id: number | bigint
  run_id: string
  workflow_id: string
  node_id: string
  title: string
  text: string
  at: string
  read_at: string | null
}

/** Newest first; `unread` counts all unread rows, not just the page. */
export function listNotices(db: DatabaseSync, limit = 50): NoticeList {
  const rows = db
    .prepare(`SELECT * FROM notices ORDER BY id DESC LIMIT ?`)
    .all(limit) as Row[]
  const unread = db
    .prepare(`SELECT COUNT(*) AS n FROM notices WHERE read_at IS NULL`)
    .get() as { n: number | bigint }
  return {
    notices: rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      text: r.text,
      runId: r.run_id,
      workflowId: r.workflow_id,
      nodeId: r.node_id,
      at: r.at,
      read: r.read_at !== null,
    })),
    unread: Number(unread.n),
  }
}

/** `ids` omitted marks every notice read. */
export function markNoticesRead(db: DatabaseSync, ids?: number[]): void {
  const at = new Date().toISOString()
  if (!ids) {
    db.prepare(`UPDATE notices SET read_at = ? WHERE read_at IS NULL`).run(at)
    return
  }
  const stmt = db.prepare(
    `UPDATE notices SET read_at = ? WHERE id = ? AND read_at IS NULL`
  )
  for (const id of ids) stmt.run(at, id)
}
