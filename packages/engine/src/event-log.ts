import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { engineEventSchema, type EngineEvent } from "@workspace/shared"
import {
  clearCliTrust,
  ensureSettingsTable,
  readCliTrust,
  writeCliTrust,
  type CliTrustValue,
} from "./settings.ts"

export type StoredEvent = {
  seq: number
  event: EngineEvent
}

/**
 * Rows written by the task engine (old event types, a task graph) no longer
 * parse. They are skipped, so such a run does not fold and the log still
 * opens (DES-034, Old runs).
 */
function parseStored(payload: string): EngineEvent | null {
  const parsed = engineEventSchema.safeParse(JSON.parse(payload))
  return parsed.success ? parsed.data : null
}

export class EventLog {
  private readonly db: DatabaseSync
  private readonly listeners = new Set<(stored: StoredEvent) => void>()
  private closed = false

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_run_id ON events (run_id);
    `)
    ensureSettingsTable(this.db)
  }

  getCliTrust(): CliTrustValue | null {
    return readCliTrust(this.db)
  }

  setCliTrust(value: CliTrustValue): void {
    writeCliTrust(this.db, value)
  }

  clearCliTrust(): void {
    clearCliTrust(this.db)
  }

  /** Subscribe to appends. Returns an unsubscribe function. */
  onAppend(listener: (stored: StoredEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Append an event in a write transaction; returns its sequence number. */
  append(event: EngineEvent): number {
    if (this.closed) throw new Error("event log is closed")
    const parsed = engineEventSchema.parse(event)
    const insert = this.db.prepare(
      `INSERT INTO events (run_id, type, at, payload) VALUES (?, ?, ?, ?)`
    )
    this.db.exec("BEGIN")
    try {
      insert.run(parsed.runId, parsed.type, parsed.at, JSON.stringify(parsed))
      const row = this.db
        .prepare(`SELECT last_insert_rowid() AS seq`)
        .get() as { seq: number | bigint }
      this.db.exec("COMMIT")
      const seq = Number(row.seq)
      const stored: StoredEvent = { seq, event: parsed }
      for (const listener of this.listeners) listener(stored)
      return seq
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  listByRun(runId: string): StoredEvent[] {
    if (this.closed) return []
    const rows = this.db
      .prepare(
        `SELECT seq, payload FROM events WHERE run_id = ? ORDER BY seq ASC`
      )
      .all(runId) as Array<{ seq: number | bigint; payload: string }>
    const out: StoredEvent[] = []
    for (const row of rows) {
      const event = parseStored(row.payload)
      if (event) out.push({ seq: Number(row.seq), event })
    }
    return out
  }

  /** Distinct run ids in log order of first appearance. */
  listRunIds(): string[] {
    const rows = this.db
      .prepare(
        `SELECT run_id FROM events GROUP BY run_id ORDER BY MIN(seq) ASC`
      )
      .all() as Array<{ run_id: string }>
    return rows.map((row) => row.run_id)
  }

  /**
   * Rewrite workflowId (and graph.id on run_started) after a dir rename
   * so past runs list under the new id (DES-013).
   */
  rebindWorkflowId(fromId: string, toId: string): void {
    if (fromId === toId) return
    const rows = this.db
      .prepare(`SELECT seq, payload FROM events`)
      .all() as Array<{ seq: number | bigint; payload: string }>
    const update = this.db.prepare(
      `UPDATE events SET payload = ? WHERE seq = ?`
    )
    this.db.exec("BEGIN")
    try {
      for (const row of rows) {
        const event = JSON.parse(row.payload) as Record<string, unknown>
        let changed = false
        if (event.workflowId === fromId) {
          event.workflowId = toId
          changed = true
        }
        const graph = event.graph as { id?: string } | undefined
        if (graph && graph.id === fromId) {
          graph.id = toId
          changed = true
        }
        if (!changed) continue
        update.run(JSON.stringify(event), Number(row.seq))
      }
      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  close(): void {
    this.closed = true
    this.db.close()
  }
}
