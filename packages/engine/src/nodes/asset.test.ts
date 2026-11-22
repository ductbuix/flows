import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "../connectors/index.ts"
import { createConfluenceConnector } from "../connectors/confluence/index.ts"
import { createStubMcpClient } from "../connectors/confluence/stub-client.ts"
import { githubConnector } from "../connectors/github/index.ts"
import { runGit } from "../connectors/github/run.ts"
import { createConnection } from "../connections.ts"
import { createEngine } from "../engine.ts"
import { EventLog } from "../event-log.ts"
import { materializeNodeRunResources } from "../library-run.ts"
import { allowMcpServerAlways, clearMcpOnceGrants } from "../mcp/trust.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { runNodes } from "./drive.ts"
import { foldSteps, latestStep } from "./fold-steps.ts"

const dirs: string[] = []

beforeEach(() => {
  clearMcpOnceGrants()
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  clearMcpOnceGrants()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}

function fakeConn(home: string, id: string, label: string) {
  const r = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope: { label },
    signIn: "cli",
    refresh: "1h",
  })
  expect(r.ok).toBe(true)
}

/** Pins like the server route, then drives the run to its end. */
async function run(
  home: string,
  graph: ReturnType<typeof workflowSchema.parse>,
  runId = "r1",
  workItemLinks: Parameters<typeof materializeNodeRunResources>[0]["workItemLinks"] = []
) {
  const log = new EventLog(appDbPath(home))
  const runRoot = runDir(workflowDir(home, graph.id), runId)
  mkdirSync(runRoot, { recursive: true })
  const pins = await materializeNodeRunResources({
    home,
    graph,
    runRoot,
    runId,
    workItemLinks,
  })
  const state = await runNodes({ log, home, runId, graph, pins })
  const events: EngineEvent[] = log.listByRun(runId).map((s) => s.event)
  log.close()
  return { state, events, runRoot, pins }
}

const wf = (resources: unknown[], run = "cat $NODE_IN/text.md") =>
  workflowSchema.parse({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "lib", kind: "asset", resources },
      { id: "use", kind: "command", run },
    ],
    edges: [
      { from: "t", to: "use" },
      { from: "lib", to: "use" },
    ],
  })

describe("asset node (fake connector)", () => {
  it("pins at start, emits folders on file and an index on text", async () => {
    const home = tempDir("flowapp-asset-")
    fakeConn(home, "demo", "alpha")
    const graph = wf(
      [{ connection: "demo", entity: "item", id: "alpha" }],
      'cat "$RESOURCE_DEMO/item/alpha/data.txt"; echo; cat "$NODE_IN/text.md"'
    )
    const { state, events, runRoot } = await run(home, graph)

    expect(events.at(-1)?.type).toBe("run_succeeded")
    expect(events.filter((e) => e.type === "library_pulled")).toHaveLength(1)
    const pulled = events.findIndex((e) => e.type === "library_pulled")
    expect(pulled).toBeGreaterThan(events.findIndex((e) => e.type === "run_started"))

    const step = latestStep(state, "lib")
    expect(step?.status).toBe("done")
    const dir = join(runRoot, "nodes/lib/pass-1")
    const index = readFileSync(join(dir, "text.md"), "utf8")
    expect(index).toContain("demo/item/alpha")
    expect(index).toMatch(/revision [0-9a-f]+/)
    const folder = join(dir, "files/demo/item/alpha")
    expect(lstatSync(folder).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(folder, "data.txt"), "utf8")).toBe("alpha")
    expect(step?.outputs).toContain("nodes/lib/pass-1/files/demo/item/alpha")

    // The wired step gets RESOURCE_<ID> and the index in its input.
    const out = readFileSync(join(runRoot, "nodes/use/pass-1/text.md"), "utf8")
    expect(out).toContain("alpha")
    expect(out).toContain("demo/item/alpha")
  })

  it("pins resources of several connections and the work item's links", async () => {
    const home = tempDir("flowapp-asset-")
    fakeConn(home, "demo", "alpha")
    fakeConn(home, "other", "beta")
    fakeConn(home, "linked", "gamma")
    const graph = wf([
      { connection: "demo", entity: "item", id: "alpha" },
      { connection: "other", entity: "item", id: "beta" },
    ])
    const { pins, runRoot } = await run(home, graph, "r1", [
      { connection: "linked", kind: "item", entityId: "gamma" } as never,
    ])
    expect(pins.resources.pins.map((p) => p.connection).sort()).toEqual([
      "demo",
      "linked",
      "other",
    ])
    expect(existsSync(join(runRoot, "resources/linked/item/gamma"))).toBe(true)
    const dir = join(runRoot, "nodes/lib/pass-1")
    expect(existsSync(join(dir, "files/other/item/beta/data.txt"))).toBe(true)
    // The link is pinned but is not an Asset resource, so it is not emitted.
    expect(existsSync(join(dir, "files/linked"))).toBe(false)
  })

  it("fails the step when a resource was not pinned", async () => {
    const home = tempDir("flowapp-asset-")
    fakeConn(home, "demo", "alpha")
    const graph = wf([{ connection: "demo", entity: "item", id: "alpha" }])
    const log = new EventLog(appDbPath(home))
    const state = await runNodes({ log, home, runId: "r1", graph })
    const events = log.listByRun("r1").map((s) => s.event)
    log.close()
    expect(latestStep(state, "lib")).toMatchObject({
      status: "failed",
      failReason: "exit",
    })
    expect(foldSteps(events).ended).toBe(true)
  })

  it("pinNodeRun returns nothing for a graph without an Asset node", async () => {
    const home = tempDir("flowapp-asset-")
    const engine = createEngine({ home })
    const graph = workflowSchema.parse({
      id: "plain",
      nodes: [{ id: "t", kind: "trigger", type: "manual" }],
      edges: [],
    })
    expect(await engine.pinNodeRun({ graph, runId: "r9" })).toBeUndefined()
    const withAsset = wf([{ connection: "nope", entity: "item", id: "x" }])
    await expect(
      engine.pinNodeRun({ graph: withAsset, runId: "r9" })
    ).rejects.toThrow(/unknown connection nope/)
  })
})

describe("asset node (GitHub fixture)", () => {
  it("emits a pinned repo checkout", async () => {
    const root = tempDir("flowapp-asset-gh-")
    const work = join(root, "work")
    const bare = join(root, "remote.git")
    await runGit(["init", "-b", "main", work])
    writeFileSync(join(work, "README.md"), "hello from repo\n")
    await runGit(["-C", work, "add", "README.md"])
    await runGit(["-C", work, "config", "user.email", "t@example.com"])
    await runGit(["-C", work, "config", "user.name", "Test"])
    await runGit(["-C", work, "commit", "-m", "init"])
    const sha = (await runGit(["-C", work, "rev-parse", "HEAD"])).trim()
    await runGit(["clone", "--bare", work, bare])

    const home = tempDir("flowapp-asset-gh-home-")
    registerConnector(githubConnector)
    const made = createConnection(home, {
      id: "github-demo",
      connector: "github",
      name: "Demo",
      scope: { owner: "acme", name: "demo", remote: bare },
      signIn: "cli",
      refresh: "never",
    })
    expect(made.ok).toBe(true)
    const graph = wf([
      { connection: "github-demo", entity: "repo", id: "acme/demo" },
    ])
    const { state, runRoot } = await run(home, graph)
    expect(latestStep(state, "lib")?.status).toBe("done")
    const dir = join(runRoot, "nodes/lib/pass-1")
    expect(readFileSync(join(dir, "text.md"), "utf8")).toContain(`revision ${sha}`)
    // `acme/demo` is one folder name: the slash is escaped.
    expect(
      readFileSync(join(dir, "files/github-demo/repo/acme%2Fdemo/README.md"), "utf8")
    ).toContain("hello from repo")
  })
})

describe("asset node (Confluence fixture)", () => {
  it("emits a pinned page as markdown", async () => {
    const home = tempDir("flowapp-asset-conf-")
    const { client } = createStubMcpClient({
      version: 7,
      markdown: "# Hello page\n",
      title: "Hello",
    })
    registerConnector(createConfluenceConnector({ connect: async () => client }))
    const made = createConnection(home, {
      id: "conf-team",
      connector: "confluence",
      name: "Team space",
      scope: { space: "TEAM", page: "42", command: "stub://asset" },
      signIn: "mcp",
      refresh: "1h",
    })
    expect(made.ok).toBe(true)
    allowMcpServerAlways(home, "stub://asset")
    const graph = wf([{ connection: "conf-team", entity: "page", id: "TEAM/42" }])
    const { state, runRoot } = await run(home, graph)
    expect(latestStep(state, "lib")?.status).toBe("done")
    const dir = join(runRoot, "nodes/lib/pass-1")
    expect(readFileSync(join(dir, "text.md"), "utf8")).toContain("(conf-team/page/TEAM/42), revision 7")
    expect(
      readFileSync(join(dir, "files/conf-team/page/TEAM%2F42/page.md"), "utf8")
    ).toBe("# Hello page\n")
  })
})
