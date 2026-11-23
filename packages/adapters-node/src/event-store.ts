import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { engineEventSchema, type EngineEvent } from "@workspace/contracts"
import type {
  EventAppendOptions,
  EventAppendResult,
  EventStore,
  StoredEvent,
} from "@workspace/core/ports"

function ensureEventsTable(db: DatabaseSync): void {
  db.exec(`
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

function parseStored(payload: string): EngineEvent | null {
  try {
    const parsed = engineEventSchema.safeParse(JSON.parse(payload))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function lastSeqForRun(db: DatabaseSync, runId: string): number {
  const row = db
    .prepare(`SELECT MAX(seq) AS seq FROM events WHERE run_id = ?`)
    .get(runId) as { seq: number | bigint | null }
  return row.seq == null ? 0 : Number(row.seq)
}

class SqliteEventStore implements EventStore {
  constructor(private readonly db: DatabaseSync) {}

  append(
    runId: string,
    events: readonly EngineEvent[],
    options: EventAppendOptions
  ): EventAppendResult {
    this.db.exec("BEGIN")
    try {
      const current = lastSeqForRun(this.db, runId)
      if (current !== options.expectSeq) {
        this.db.exec("ROLLBACK")
        return { ok: false, kind: "conflict", lastSeq: current }
      }
      if (events.length === 0) {
        this.db.exec("COMMIT")
        return { ok: true, lastSeq: current, appended: [] }
      }
      const insert = this.db.prepare(
        `INSERT INTO events (run_id, type, at, payload) VALUES (?, ?, ?, ?)`
      )
      const appended: StoredEvent[] = []
      for (const raw of events) {
        const event = engineEventSchema.parse(raw)
        if (event.runId !== runId) {
          throw new Error(`event runId ${event.runId} !== ${runId}`)
        }
        insert.run(event.runId, event.type, event.at, JSON.stringify(event))
        const row = this.db
          .prepare(`SELECT last_insert_rowid() AS seq`)
          .get() as { seq: number | bigint }
        appended.push({ seq: Number(row.seq), event })
      }
      this.db.exec("COMMIT")
      return {
        ok: true,
        lastSeq: appended[appended.length - 1]!.seq,
        appended,
      }
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  read(runId: string, fromSeq = 0): StoredEvent[] {
    const rows = this.db
      .prepare(
        `SELECT seq, payload FROM events
         WHERE run_id = ? AND seq >= ?
         ORDER BY seq ASC`
      )
      .all(runId, fromSeq) as Array<{ seq: number | bigint; payload: string }>
    const out: StoredEvent[] = []
    for (const row of rows) {
      const event = parseStored(row.payload)
      if (event) out.push({ seq: Number(row.seq), event })
    }
    return out
  }

  tail(): number {
    const row = this.db.prepare(`SELECT MAX(seq) AS seq FROM events`).get() as {
      seq: number | bigint | null
    }
    return row.seq == null ? 0 : Number(row.seq)
  }
}

/** Bind an EventStore to an open SQLite db (events table only). */
export function openNodeEventStore(db: DatabaseSync): EventStore {
  ensureEventsTable(db)
  return new SqliteEventStore(db)
}

export type NodeEventStore = EventStore & { close(): void }

/** Open a db file and return an EventStore that owns the connection. */
export function createNodeEventStore(options: {
  dbPath: string
}): NodeEventStore {
  mkdirSync(dirname(options.dbPath), { recursive: true })
  const db = new DatabaseSync(options.dbPath)
  const store = openNodeEventStore(db)
  return {
    append: (runId, events, opts) => store.append(runId, events, opts),
    read: (runId, fromSeq) => store.read(runId, fromSeq),
    tail: () => store.tail(),
    close: () => db.close(),
  }
}
