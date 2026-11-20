import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { engineEventSchema, type EngineEvent } from "@workspace/shared"

export type StoredEvent = {
  seq: number
  event: EngineEvent
}

export class EventLog {
  private readonly db: DatabaseSync
  private readonly listeners = new Set<(stored: StoredEvent) => void>()

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
    const rows = this.db
      .prepare(
        `SELECT seq, payload FROM events WHERE run_id = ? ORDER BY seq ASC`
      )
      .all(runId) as Array<{ seq: number | bigint; payload: string }>
    return rows.map((row) => ({
      seq: Number(row.seq),
      event: engineEventSchema.parse(JSON.parse(row.payload)),
    }))
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

  close(): void {
    this.db.close()
  }
}
