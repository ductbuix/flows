import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
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
import { createConnection, readConnection } from "./connections.ts"
import { createEngine } from "./engine.ts"
import { listLibrary } from "./library-list.ts"
import { pullEntity } from "./library.ts"
import {
  clearEntityRevisions,
  LIBRARY_RETENTION_MS,
  sweepLibrary,
} from "./library-retention.ts"
import { LibraryCapError } from "./library-usage.ts"
import { libraryEntityDir } from "./paths.ts"
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
  const home = mkdtempSync(join(tmpdir(), "flowapp-ret-"))
  homes.push(home)
  return home
}

function writeConn(home: string, id: string, label: string) {
  const result = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope: { label },
    signIn: "cli",
    refresh: "never",
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

function ageRevision(revDir: string, ageMs: number): void {
  const past = new Date(Date.now() - ageMs)
  const metaPath = join(revDir, "meta.json")
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    pulledAt: string
  }
  meta.pulledAt = past.toISOString()
  writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  utimesSync(revDir, past, past)
}

describe("library retention", () => {
  it("keeps pinned and current; sweeps old unpinned", async () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", "alpha")!
    const first = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "alpha",
      force: true,
    })
    const second = await pullEntity({
      home,
      connection: { ...conn, scope: { label: "beta" } },
      kind: "item",
      entityId: "alpha",
      force: true,
    })
    expect(second.revision).not.toBe(first.revision)

    const entityRoot = libraryEntityDir(home, "demo", "item", "alpha")
    ageRevision(join(entityRoot, first.revision), LIBRARY_RETENTION_MS + 60_000)

    const wf = writeWorkflow(
      home,
      "pin-wf",
      `
id: pin-wf
nodes:
  - id: lib
    kind: asset
    resources:
      - { connection: demo, entity: item, id: alpha }
edges: []
`
    )
    // Pin the old revision by writing resources.json for a finished run.
    const runRoot = join(wf, "runs", "keep-pin")
    mkdirSync(runRoot, { recursive: true })
    writeFileSync(
      join(runRoot, "resources.json"),
      JSON.stringify({
        v: 1,
        pins: [
          {
            connection: "demo",
            kind: "item",
            entityId: "alpha",
            revision: first.revision,
            title: "demo",
          },
        ],
        warnings: [],
      })
    )

    const third = await pullEntity({
      home,
      connection: { ...conn, scope: { label: "gamma" } },
      kind: "item",
      entityId: "alpha",
      force: true,
    })
    ageRevision(
      join(entityRoot, second.revision),
      LIBRARY_RETENTION_MS + 60_000
    )

    const result = await sweepLibrary(home)
    expect(existsSync(join(entityRoot, first.revision))).toBe(true)
    expect(existsSync(join(entityRoot, second.revision))).toBe(false)
    expect(existsSync(join(entityRoot, third.revision))).toBe(true)
    expect(result.removed.some((r) => r.includes(second.revision))).toBe(true)
  })

  it("never removes current even when old and unpinned", async () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", "x")!
    const pulled = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "x",
      force: true,
    })
    const entityRoot = libraryEntityDir(home, "demo", "item", "x")
    ageRevision(
      join(entityRoot, pulled.revision),
      LIBRARY_RETENTION_MS + 60_000
    )
    await sweepLibrary(home)
    expect(existsSync(join(entityRoot, pulled.revision))).toBe(true)
  })

  it("rejects pull at the size cap and leaves pins", async () => {
    const home = tempHome()
    writeFileSync(join(home, "config.yaml"), "library:\n  maxBytes: 200\n")
    const conn = writeConn(home, "demo", "pad")!
    const first = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "pad",
      force: true,
    })
    const entityRoot = libraryEntityDir(home, "demo", "item", "pad")
    writeFileSync(join(entityRoot, first.revision, "pad.bin"), "x".repeat(400))

    await expect(
      pullEntity({
        home,
        connection: { ...conn, scope: { label: "more" } },
        kind: "item",
        entityId: "pad",
        force: true,
      })
    ).rejects.toBeInstanceOf(LibraryCapError)

    expect(existsSync(join(entityRoot, first.revision))).toBe(true)
    const listed = listLibrary(home)
    expect(listed.usage.usedBytes).toBeGreaterThanOrEqual(listed.usage.maxBytes)
    expect(listed.usage.maxBytes).toBe(200)
  })

  it("clear removes unpinned only and never touches work items", async () => {
    const home = tempHome()
    const conn = writeConn(home, "demo", "a")!
    const first = await pullEntity({
      home,
      connection: conn,
      kind: "item",
      entityId: "a",
      force: true,
    })
    const second = await pullEntity({
      home,
      connection: { ...conn, scope: { label: "b" } },
      kind: "item",
      entityId: "a",
      force: true,
    })
    const { item } = createWorkItem(home, { title: "Story" })
    const wiPath = join(home, "workitems", item.id)
    expect(existsSync(wiPath)).toBe(true)

    const cleared = clearEntityRevisions(home, "demo", "item", "a")
    expect(cleared.removed).toContain(first.revision)
    expect(cleared.removed).not.toContain(second.revision)
    expect(
      existsSync(
        join(libraryEntityDir(home, "demo", "item", "a"), first.revision)
      )
    ).toBe(false)
    expect(
      existsSync(
        join(libraryEntityDir(home, "demo", "item", "a"), second.revision)
      )
    ).toBe(true)
    expect(existsSync(wiPath)).toBe(true)
    expect(readFileSync(join(wiPath, "workitem.yaml"), "utf8")).toContain(
      "Story"
    )
  })

  it("deleting a run releases its pins so sweep can remove them", async () => {
    const home = tempHome()
    writeConn(home, "demo", "z")
    const graph = workflowSchema.parse({
      id: "del-pin",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "lib",
          kind: "asset",
          resources: [{ connection: "demo", entity: "item", id: "z" }],
        },
        { id: "o", kind: "output", target: "folder" },
      ],
      edges: [
        { from: "t", to: "o" },
        { from: "lib", to: "o" },
      ],
    })
    const engine = createEngine({ home })
    const pins = await engine.pinNodeRun({ graph, runId: "r-pin" })
    await engine.startNodeRun({ graph, runId: "r-pin", pins }).wait()
    const entityRoot = libraryEntityDir(home, "demo", "item", "z")
    const rev = listLibrary(home).entities[0]?.revisions[0]?.revision
    expect(rev).toBeTruthy()
    const existing = readConnection(home, "demo")!
    const newer = await pullEntity({
      home,
      connection: { ...existing, scope: { label: "z2" } },
      kind: "item",
      entityId: "z",
      force: true,
    })
    expect(newer.revision).not.toBe(rev)
    ageRevision(join(entityRoot, rev!), LIBRARY_RETENTION_MS + 60_000)

    await sweepLibrary(home)
    expect(existsSync(join(entityRoot, rev!))).toBe(true)

    engine.deleteRun("r-pin")
    const sweep = await sweepLibrary(home)
    expect(existsSync(join(entityRoot, rev!))).toBe(false)
    expect(sweep.removed.some((r) => r.includes(rev!))).toBe(true)
    engine.close()
  })
})
