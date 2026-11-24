import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { openNodeEventStore } from "@workspace/adapters-node"
import type { EventStore, StoredEvent } from "@workspace/core/ports"
import {
  engineEventSchema,
  type EngineEvent,
  type NoticeList,
} from "@workspace/shared"
import {
  ensureNoticesTable,
  listNotices,
  markNoticesRead,
  postNotice,
  type NewNotice,
} from "./notices.ts"
import {
  clearCliTrust,
  ensureSettingsTable,
  readCliTrust,
  writeCliTrust,
  type CliTrustValue,
} from "./settings.ts"

export type { StoredEvent }

/**
 * App db: EventStore for run events; settings and notices share the file.
 * Unparseable old rows are skipped on read (DES-034, Old runs).
 */
export class EventLog {
  private readonly db: DatabaseSync
  private readonly store: EventStore
  private readonly listeners = new Set<(stored: StoredEvent) => void>()
  /** Last seq per run for expectSeq without an extra SELECT on each append. */
  private readonly lastSeq = new Map<string, number>()
  private closed = false

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath)
    this.store = openNodeEventStore(this.db)
    ensureSettingsTable(this.db)
    ensureNoticesTable(this.db)
  }

  /** Posts a notice once per key; a repeat of the same step adds nothing (BL-100). */
  postNotice(n: NewNotice): void {
    postNotice(this.db, n)
  }

  listNotices(limit?: number): NoticeList {
    return listNotices(this.db, limit)
  }

  markNoticesRead(ids?: number[]): void {
    markNoticesRead(this.db, ids)
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

  /** Append an event via EventStore; returns its sequence number. */
  append(event: EngineEvent): number {
    if (this.closed) throw new Error("event log is closed")
    const parsed = engineEventSchema.parse(event)
    let expectSeq = this.lastSeq.get(parsed.runId) ?? 0
    for (let attempt = 0; attempt < 8; attempt++) {
      const result = this.store.append(parsed.runId, [parsed], { expectSeq })
      if (!result.ok) {
        expectSeq = result.lastSeq
        this.lastSeq.set(parsed.runId, expectSeq)
        continue
      }
      const stored = result.appended[0]!
      this.lastSeq.set(parsed.runId, stored.seq)
      for (const listener of this.listeners) listener(stored)
      return stored.seq
    }
    throw new Error(`event append conflict for ${parsed.runId}`)
  }

  listByRun(runId: string): StoredEvent[] {
    if (this.closed) throw new Error("event log is closed")
    const stored = this.store.read(runId)
    const last = stored[stored.length - 1]
    if (last) this.lastSeq.set(runId, last.seq)
    return stored
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
