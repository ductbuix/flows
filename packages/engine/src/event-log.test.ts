import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"
import { appDbPath } from "./paths.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

describe("runs stored by the task engine", () => {
  it("are skipped, so the log opens and other runs still fold", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-oldlog-"))
    homes.push(home)
    createEngine({ home }).close()

    const db = new DatabaseSync(appDbPath(home))
    const insert = db.prepare(
      "INSERT INTO events (run_id, type, at, payload) VALUES (?, ?, ?, ?)"
    )
    const at = "2026-01-01T00:00:00.000Z"
    const old = [
      {
        type: "run_started",
        runId: "old",
        at,
        workflowId: "w",
        graph: { id: "w", tasks: [{ id: "a", kind: "command", run: "x" }] },
      },
      { type: "task_succeeded", runId: "old", at, taskId: "a" },
      { type: "run_succeeded", runId: "old", at },
    ]
    for (const e of old) insert.run(e.runId, e.type, at, JSON.stringify(e))
    db.close()

    const engine = createEngine({ home })
    expect(engine.fold("old")).toBeNull()
    expect(engine.listRuns()).toEqual([])
    engine.bootHousekeeping()
    engine.close()
  })
})
