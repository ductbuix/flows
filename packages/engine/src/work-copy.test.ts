import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
import { runDir, workflowDir } from "./paths.ts"
import {
  copyPinnedEntity,
  diffWorkCopy,
  ensureLibraryGcAutoOff,
  workEntityDir,
} from "./work-copy.ts"

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
  const home = mkdtempSync(join(tmpdir(), "flowapp-work-"))
  homes.push(home)
  return home
}

function writeConn(
  home: string,
  id: string,
  scope: Record<string, string>,
  opts?: { serial?: boolean }
) {
  const result = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope,
    signIn: "cli",
    refresh: "1h",
    ...(opts?.serial ? { serial: true } : {}),
  })
  expect(result.ok).toBe(true)
  return result.ok ? result.value : null
}

/** Asset (propose) -> command edit(s) in a chain; each edits the work copy. */
function proposeGraph(id: string, runs: string[]) {
  const nodes: object[] = [
    { id: "t", kind: "trigger", type: "manual" },
    {
      id: "lib",
      kind: "asset",
      access: "propose",
      resources: [{ connection: "demo", entity: "item", id: "v1" }],
    },
  ]
  const edges: object[] = []
  let prev = "t"
  runs.forEach((run, i) => {
    nodes.push({ id: `c${i}`, kind: "command", run })
    edges.push({ from: prev, to: `c${i}` })
    edges.push({ from: "lib", to: `c${i}` })
    prev = `c${i}`
  })
  return workflowSchema.parse({ id, nodes, edges })
}

async function runPropose(
  engine: ReturnType<typeof createEngine>,
  graph: ReturnType<typeof proposeGraph>
) {
  const pins = await engine.pinNodeRun({ graph, runId: "r1" })
  return engine.startNodeRun({ graph, runId: "r1", pins }).wait()
}

describe("work copies", () => {
  it("creates a shared copy on first propose and reuses it", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const graph = proposeGraph("propose-reuse", [
      'echo changed > "$RESOURCE_DEMO/item/v1/data.txt"',
      'grep -q changed "$RESOURCE_DEMO/item/v1/data.txt"',
    ])
    const engine = createEngine({ home })
    const state = await runPropose(engine, graph)
    expect(state.status).toBe("succeeded")
    const work = workEntityDir(
      runDir(workflowDir(home, "propose-reuse"), "r1"),
      "demo",
      "item",
      "v1"
    )
    expect(existsSync(work)).toBe(true)
    expect(readFileSync(join(work, "data.txt"), "utf8").trim()).toBe("changed")
    engine.close()
  }, 30_000)

  it("diffs work vs base, empty diff, and destructive flag", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const graph = proposeGraph("diff-wf", ["true"])
    const engine = createEngine({ home })
    await runPropose(engine, graph)
    const runRoot = runDir(workflowDir(home, "diff-wf"), "r1")

    const empty = await diffWorkCopy({
      home,
      runRoot,
      connectionId: "demo",
    })
    expect(empty.changeSet.ops).toEqual([])
    expect(empty.previewMd).toMatch(/No changes/)

    writeFileSync(
      join(workEntityDir(runRoot, "demo", "item", "v1"), "data.txt"),
      "edited"
    )
    writeFileSync(
      join(workEntityDir(runRoot, "demo", "item", "v1"), "gone.destructive"),
      "__destructive__ wipe"
    )
    const changed = await diffWorkCopy({
      home,
      runRoot,
      connectionId: "demo",
    })
    expect(changed.changeSet.ops.length).toBeGreaterThanOrEqual(2)
    expect(changed.changeSet.ops.some((o) => o.destructive)).toBe(true)
    expect(changed.previewMd).toMatch(/destructive/)
    engine.close()
  }, 30_000)

  it("deleting a run removes its work copies", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const graph = proposeGraph("delete-work", [
      'echo hi > "$RESOURCE_DEMO/item/v1/data.txt"',
    ])
    const engine = createEngine({ home })
    await runPropose(engine, graph)
    const runRoot = runDir(workflowDir(home, "delete-work"), "r1")
    const work = join(runRoot, "work")
    expect(existsSync(work)).toBe(true)
    engine.deleteRun("r1")
    expect(existsSync(work)).toBe(false)
    expect(existsSync(runRoot)).toBe(false)
    engine.close()
  }, 30_000)

  it("git clone --shared work copy allows commit; library has gc.auto=0", () => {
    const home = tempHome()
    const src = join(home, "repo-src")
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, "readme.txt"), "hello")
    execFileSync("git", ["-C", src, "init"], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", src, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", src, "commit", "-m", "init"], {
      stdio: "ignore",
    })

    const dest = join(home, "work-repo")
    copyPinnedEntity(src, dest)
    ensureLibraryGcAutoOff(src)
    const gc = execFileSync("git", ["-C", src, "config", "gc.auto"], {
      encoding: "utf8",
    }).trim()
    expect(gc).toBe("0")

    writeFileSync(join(dest, "readme.txt"), "hello world")
    execFileSync("git", ["-C", dest, "add", "."], { stdio: "ignore" })
    execFileSync("git", ["-C", dest, "config", "user.email", "t@example.com"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "config", "user.name", "test"], {
      stdio: "ignore",
    })
    execFileSync("git", ["-C", dest, "commit", "-m", "edit"], {
      stdio: "ignore",
    })
    const log = execFileSync("git", ["-C", dest, "log", "--oneline"], {
      encoding: "utf8",
    })
    expect(log).toMatch(/edit/)
  })
})
