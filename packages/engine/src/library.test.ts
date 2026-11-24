import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/shared"
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
import { libraryEntityDir, runDir, workflowDir } from "./paths.ts"
import { createWorkItem } from "./workitems.ts"

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

/** A node graph with one Asset on `connection`'s item `id`, or none. */
function assetGraph(id: string, resource?: { connection: string; id: string }) {
  return workflowSchema.parse({
    id,
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      ...(resource
        ? [
            {
              id: "lib",
              kind: "asset",
              resources: [
                {
                  connection: resource.connection,
                  entity: "item",
                  id: resource.id,
                },
              ],
            },
          ]
        : [{ id: "p", kind: "prompt" }]),
      { id: "o", kind: "output", target: "folder" },
    ],
    edges: [
      { from: "t", to: "o" },
      { from: resource ? "lib" : "p", to: "o" },
    ],
  })
}

const resourcesOf = (home: string, wf: string, runId: string) =>
  JSON.parse(
    readFileSync(
      join(runDir(workflowDir(home, wf), runId), "resources.json"),
      "utf8"
    )
  )

describe("pull at run start and resources", () => {
  it("pins Asset resources before run_started and writes resources.json", async () => {
    const home = tempHome()
    writeConn(home, "rally-pay", { label: "PAY-1" })
    const graph = assetGraph("with-assets", {
      connection: "rally-pay",
      id: "PAY-1",
    })
    const engine = createEngine({ home })
    const pins = await engine.pinNodeRun({ graph, runId: "r1" })
    const runRoot = runDir(workflowDir(home, "with-assets"), "r1")
    const resources = resourcesOf(home, "with-assets", "r1")
    expect(resources.v).toBe(1)
    expect(resources.pins).toHaveLength(1)
    expect(resources.pins[0].connection).toBe("rally-pay")
    expect(resources.pins[0].entityId).toBe("PAY-1")
    expect(existsSync(join(runRoot, "resources", "index.json"))).toBe(true)
    expect(pins?.pulledEvents.length).toBeGreaterThan(0)
    engine.close()
  })

  it("pulls work item links at run start (BL-046)", async () => {
    const home = tempHome()
    writeConn(home, "ctx-src", { label: "CTX-1" })
    const { item } = createWorkItem(home, {
      title: "From context",
      links: [{ connection: "ctx-src", kind: "item", entityId: "CTX-1" }],
    })
    // Links are pulled only when the graph has an Asset node.
    const graph = assetGraph("link-only", {
      connection: "ctx-src",
      id: "CTX-1",
    })
    const engine = createEngine({ home })
    await engine.pinNodeRun({ graph, runId: "r-link", workItemId: item.id })
    expect(resourcesOf(home, "link-only", "r-link").pins).toEqual([
      expect.objectContaining({
        connection: "ctx-src",
        kind: "item",
        entityId: "CTX-1",
      }),
    ])
    engine.close()
  })

  it("fails start when pull fails and no revision exists", async () => {
    const home = tempHome()
    writeConn(home, "bad", { label: "x", signedOut: "1" })
    const graph = assetGraph("fail-pull", { connection: "bad", id: "x" })
    const engine = createEngine({ home })
    await expect(engine.pinNodeRun({ graph, runId: "r1" })).rejects.toThrow(
      /library pull failed|signed out|fake signed out/
    )
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

    const graph = assetGraph("warn-pull", { connection: "flaky", id: "x" })
    const engine = createEngine({ home })
    const pins = await engine.pinNodeRun({ graph, runId: "r1" })
    const resources = resourcesOf(home, "warn-pull", "r1")
    expect(resources.pins[0].revision).toBe(rev)
    expect(resources.warnings.length).toBeGreaterThan(0)
    expect(pins).toBeDefined()
    engine.close()
  })

  it("rerun reuses pins; refreshPins pulls again", async () => {
    const home = tempHome()
    writeConn(home, "src", { label: "v1" }, "never")
    const graph = assetGraph("rerun-pins", { connection: "src", id: "v1" })
    const engine = createEngine({ home })
    await engine.pinNodeRun({ graph, runId: "r1" })
    const rev1 = resourcesOf(home, "rerun-pins", "r1").pins[0].revision

    await engine.pinNodeRun({ graph, runId: "r2", pinFromRunId: "r1" })
    expect(resourcesOf(home, "rerun-pins", "r2").pins[0].revision).toBe(rev1)

    await engine.pinNodeRun({
      graph,
      runId: "r3",
      pinFromRunId: "r1",
      refreshPins: true,
    })
    expect(resourcesOf(home, "rerun-pins", "r3").pins[0].revision).not.toBe(
      rev1
    )
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

    const graph = assetGraph("list-pins", { connection: "demo", id: "z" })
    await engine.pinNodeRun({ graph, runId: "r1" })
    const listed = listLibrary(home)
    expect(listed.entities).toHaveLength(1)
    expect(listed.entities[0].entityId).toBe("z")
    expect(
      listed.entities[0].revisions.some((r) => r.pinningRunIds.includes("r1"))
    ).toBe(true)
    engine.close()
  })
})
