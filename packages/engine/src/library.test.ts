import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { createEngine } from "./engine.ts"
import { listLibrary } from "./library-list.ts"
import { currentRevision, isFresh } from "./library-paths.ts"
import { pullNow } from "./library-run.ts"
import {
  LIBRARY_EVENT_RUN_ID,
  pullEntity,
  resolveScopeEntity,
} from "./library.ts"
import { libraryEntityDir } from "./paths.ts"

const homes: string[] = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-lib-"))
  homes.push(home)
  return home
}

function writeConn(
  home: string,
  id: string,
  scope: Record<string, string>,
  refresh = "1h"
) {
  const result = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope,
    signIn: "cli",
    refresh: refresh as "1h" | "never" | "15m" | "1d",
  })
  expect(result.ok).toBe(true)
  return result.ok ? result.value : null
}

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(wf, { recursive: true })
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

describe("library store", () => {
  it("writes immutable revisions and moves current atomically", async () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", { label: "alpha" })!
    const first = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "alpha",
      force: true,
    })
    const entityRoot = libraryEntityDir(home, "demo", "item", "alpha")
    expect(readlinkSync(join(entityRoot, "current"))).toBe(first.revision)
    expect(
      readFileSync(join(entityRoot, first.revision, "data.txt"), "utf8")
    ).toBe("alpha")

    const second = await pullEntity({
      home,
      connection: { ...conn, scope: { label: "beta" } },
      kind: "item",
      entityId: "alpha",
      force: true,
    })
    expect(second.revision).not.toBe(first.revision)
    expect(readlinkSync(join(entityRoot, "current"))).toBe(second.revision)
    expect(
      readFileSync(join(entityRoot, first.revision, "data.txt"), "utf8")
    ).toBe("alpha")
    expect(existsSync(join(entityRoot, first.revision))).toBe(true)
  })

  it("skips pull when current is fresh for the refresh rule", async () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", { label: "x" }, "1h")!
    const first = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "x",
    })
    const again = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "x",
    })
    expect(again.fromCache).toBe(true)
    expect(again.revision).toBe(first.revision)
    expect(isFresh(again.pulledAt, "1h")).toBe(true)
  })

  it("resolveScopeEntity uses connector kind and scope fields", () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", { label: "story-1" })!
    expect(resolveScopeEntity(conn)).toEqual({
      kind: "item",
      entityId: "story-1",
      title: "demo",
    })
  })
})

describe("pull at run start and resources", () => {
  it("pulls uses, writes resources.json before run_started, sets env", async () => {
    const home = tempHome()
    writeConn(home, "rally-pay", { label: "PAY-1" })
    const wf = writeWorkflow(
      home,
      "with-uses",
      `
id: with-uses
tasks:
  - id: a
    kind: command
    uses:
      - { connection: rally-pay, access: read }
    run: "test -f \\"$RESOURCES_DIR/rally-pay/item/PAY-1/data.txt\\" && test -f \\"$RESOURCE_RALLY_PAY/item/PAY-1/data.txt\\" && cat \\"$RESOURCE_RALLY_PAY/item/PAY-1/data.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    const runRoot = join(wf, "runs", "r1")
    const resources = JSON.parse(
      readFileSync(join(runRoot, "resources.json"), "utf8")
    )
    expect(resources.v).toBe(1)
    expect(resources.pins).toHaveLength(1)
    expect(resources.pins[0].connection).toBe("rally-pay")
    expect(resources.pins[0].entityId).toBe("PAY-1")
    expect(existsSync(join(runRoot, "resources", "index.json"))).toBe(true)
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(engine.events("r1").some((e) => e.type === "library_pulled")).toBe(
      true
    )
    const startedIdx = engine
      .events("r1")
      .findIndex((e) => e.type === "run_started")
    const pulledIdx = engine
      .events("r1")
      .findIndex((e) => e.type === "library_pulled")
    expect(startedIdx).toBeGreaterThanOrEqual(0)
    expect(pulledIdx).toBeGreaterThan(startedIdx)
    engine.close()
  })

  it("fails start when pull fails and no revision exists", async () => {
    const home = tempHome()
    writeConn(home, "bad", { label: "x", signedOut: "1" })
    const wf = writeWorkflow(
      home,
      "fail-pull",
      `
id: fail-pull
tasks:
  - id: a
    kind: command
    uses:
      - { connection: bad, access: read }
    run: "echo ok"
`
    )
    const engine = createEngine({ home })
    await expect(
      engine.startRun({ workflowDir: wf, runId: "r1" })
    ).rejects.toThrow(/library pull failed|signed out|fake signed out/)
    engine.close()
  })

  it("starts with a warning when pull fails but a revision exists", async () => {
    const home = tempHome()
    const conn = writeConn(home, "flaky", { label: "x" })!
    await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "x",
    })
    // Break sign-in for the next pull while keeping the revision.
    writeFileSync(
      join(home, "connections", "flaky", "connection.yaml"),
      [
        "id: flaky",
        "connector: fake",
        "name: flaky",
        "signIn: cli",
        "refresh: 15m",
        "scope:",
        "  label: x",
        "  signedOut: '1'",
        "  failPull: boom",
        "",
      ].join("\n")
    )
    // Force refresh so pull is attempted (stale if we rewind meta).
    const rev = currentRevision(home, "flaky", "item", "x")!
    const metaPath = join(
      libraryEntityDir(home, "flaky", "item", "x"),
      rev,
      "meta.json"
    )
    const meta = JSON.parse(readFileSync(metaPath, "utf8"))
    meta.pulledAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    writeFileSync(metaPath, JSON.stringify(meta))

    const wf = writeWorkflow(
      home,
      "warn-pull",
      `
id: warn-pull
tasks:
  - id: a
    kind: command
    uses:
      - { connection: flaky, access: read }
    run: "test -f \\"$RESOURCE_FLAKY/item/x/data.txt\\""
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    const resources = JSON.parse(
      readFileSync(join(wf, "runs", "r1", "resources.json"), "utf8")
    )
    expect(resources.pins[0].revision).toBe(rev)
    expect(resources.warnings.length).toBeGreaterThan(0)
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    engine.close()
  })

  it("rerun reuses pins; refreshPins pulls again", async () => {
    const home = tempHome()
    writeConn(home, "src", { label: "v1" }, "never")
    const wf = writeWorkflow(
      home,
      "rerun-pins",
      `
id: rerun-pins
tasks:
  - id: a
    kind: command
    uses:
      - { connection: src, access: read }
    run: "echo ok"
`
    )
    const engine = createEngine({ home })
    await (await engine.startRun({ workflowDir: wf, runId: "r1" })).wait()
    const pins1 = JSON.parse(
      readFileSync(join(wf, "runs", "r1", "resources.json"), "utf8")
    ).pins
    await (
      await engine.startRun({
        workflowDir: wf,
        runId: "r2",
        pinFromRunId: "r1",
      })
    ).wait()
    const pins2 = JSON.parse(
      readFileSync(join(wf, "runs", "r2", "resources.json"), "utf8")
    ).pins
    expect(pins2[0].revision).toBe(pins1[0].revision)

    await (
      await engine.startRun({
        workflowDir: wf,
        runId: "r3",
        pinFromRunId: "r1",
        refreshPins: true,
      })
    ).wait()
    const pins3 = JSON.parse(
      readFileSync(join(wf, "runs", "r3", "resources.json"), "utf8")
    ).pins
    expect(pins3[0].revision).not.toBe(pins1[0].revision)
    engine.close()
  })

  it("queued runs pin at start, not on activate", async () => {
    const home = tempHome()
    writeConn(home, "src", { label: "q" })
    const wf = writeWorkflow(
      home,
      "queue-pin",
      `
id: queue-pin
tasks:
  - id: a
    kind: command
    uses:
      - { connection: src, access: read }
    run: "sleep 0.2 && echo ok"
`
    )
    const engine = createEngine({ home })
    const first = await engine.startRun({ workflowDir: wf, runId: "a" })
    const second = await engine.startRun({ workflowDir: wf, runId: "b" })
    expect(second.status).toBe("queued")
    expect(existsSync(join(wf, "runs", "b", "resources.json"))).toBe(true)
    const pinsBefore = JSON.parse(
      readFileSync(join(wf, "runs", "b", "resources.json"), "utf8")
    ).pins[0].revision
    await first.wait()
    await second.wait()
    const pinsAfter = JSON.parse(
      readFileSync(join(wf, "runs", "b", "resources.json"), "utf8")
    ).pins[0].revision
    expect(pinsAfter).toBe(pinsBefore)
    engine.close()
  })
})

describe("library API helpers", () => {
  it("pullNow records library_pulled and listLibrary shows pins", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "z" })
    const engine = createEngine({ home })
    const { result, event } = await pullNow({
      home,
      connectionId: "demo",
    })
    engine.appendLibraryEvent(event)
    expect(result.entityId).toBe("z")
    expect(
      engine
        .events(LIBRARY_EVENT_RUN_ID)
        .some((e) => e.type === "library_pulled")
    ).toBe(true)

    const wf = writeWorkflow(
      home,
      "list-pins",
      `
id: list-pins
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: read }
    run: "echo ok"
`
    )
    await (await engine.startRun({ workflowDir: wf, runId: "r1" })).wait()
    const listed = listLibrary(home)
    expect(listed.entities).toHaveLength(1)
    expect(listed.entities[0].entityId).toBe("z")
    expect(
      listed.entities[0].revisions.some((r) => r.pinningRunIds.includes("r1"))
    ).toBe(true)
    engine.close()
  })
})
