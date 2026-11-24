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
import {
  workflowSchema,
  type EngineEvent,
  type Workflow,
} from "@workspace/shared"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "../connectors/index.ts"
import { createGithubConnector } from "../connectors/github/index.ts"
import { runGit, type CommandResult } from "../connectors/github/run.ts"
import { createConnection } from "../connections.ts"
import { createEngine } from "../engine.ts"
import { EventLog } from "../event-log.ts"
import { materializeNodeRunResources } from "../library-run.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { approveNodeStep, rejectNodeStep } from "./cancel.ts"
import { resumeNodes, runNodes } from "./drive.ts"
import { foldSteps, latestStep } from "./fold-steps.ts"
import type { ProcessHost } from "./process.ts"
import { assertNodePublishValid } from "./publish.ts"

const dirs: string[] = []
const logs: EventLog[] = []
const hosts: ProcessHost[] = []

beforeEach(() => registerConnector(fakeConnector))
afterEach(() => {
  clearConnectors()
  // Stop pumps before closing logs so a late wake cannot read a closed DB.
  for (const h of hosts.splice(0)) h.stop()
  for (const l of logs.splice(0)) l.close()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}

function fakeConn(
  home: string,
  id: string,
  scope: Record<string, string> = {},
  policy: "read-only" | "approve-each-publish" = "approve-each-publish"
) {
  const r = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope: { label: "v1", ...scope },
    signIn: "cli",
    refresh: "1h",
    policy,
  })
  expect(r.ok).toBe(true)
}

/** Asset (propose) -> command that edits the work copy -> publish Output. */
function wf(connections: string[] = ["demo"], edit?: string) {
  const nodes: object[] = [{ id: "t", kind: "trigger", type: "manual" }]
  const edges: object[] = []
  for (const c of connections) {
    const env = `RESOURCE_${c.toUpperCase().replaceAll("-", "_")}`
    nodes.push(
      {
        id: `lib-${c}`,
        kind: "asset",
        access: "propose",
        resources: [{ connection: c, entity: "item", id: "v1" }],
      },
      {
        id: `edit-${c}`,
        kind: "command",
        run: edit ?? `echo changed > "$${env}/item/v1/data.txt"`,
      },
      { id: `ship-${c}`, kind: "output", target: "publish", connection: c }
    )
    edges.push(
      { from: "t", to: `edit-${c}` },
      { from: `lib-${c}`, to: `edit-${c}` },
      { from: `edit-${c}`, to: `ship-${c}` }
    )
  }
  return workflowSchema.parse({ id: "wf", nodes, edges })
}

type Started = {
  log: EventLog
  done: Promise<unknown>
  host: () => ProcessHost
  runRoot: string
  events: () => EngineEvent[]
  status: (id: string) => string | undefined
}

async function start(
  home: string,
  graph: Workflow,
  runId = "r1"
): Promise<Started> {
  const log = new EventLog(appDbPath(home))
  logs.push(log)
  const runRoot = runDir(workflowDir(home, graph.id), runId)
  mkdirSync(runRoot, { recursive: true })
  const pins = await materializeNodeRunResources({
    home,
    graph,
    runRoot,
    runId,
    workItemLinks: [],
  })
  let host: ProcessHost | undefined
  const done = runNodes({ log, home, runId, graph, pins }, (h) => {
    host = h
    hosts.push(h)
  })
  const events = () => log.listByRun(runId).map((s) => s.event)
  return {
    log,
    done,
    host: () => host!,
    runRoot,
    events,
    status: (id) => latestStep(foldSteps(events()), id)?.status,
  }
}

async function until(cond: () => boolean, ms = 15_000): Promise<void> {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting")
    await new Promise((r) => setTimeout(r, 20))
  }
}

function approve(s: Started, nodeId: string) {
  approveNodeStep(s.log, "r1", nodeId)
  s.host().wake()
}

const types = (events: EngineEvent[], type: string) =>
  events.filter((e) => e.type === type) as (EngineEvent & {
    connection?: string
  })[]

describe("output publish: validation", () => {
  it("needs a connection and an upstream propose Asset", () => {
    const base = {
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "lib",
          kind: "asset",
          access: "read",
          resources: [{ connection: "demo", entity: "item", id: "v1" }],
        },
        { id: "o", kind: "output", target: "publish", connection: "demo" },
      ],
      edges: [{ from: "lib", to: "o" }],
    }
    const msgs = (g: unknown) => {
      const r = workflowSchema.safeParse(g)
      return r.success ? [] : r.error.issues.map((i) => i.message)
    }
    expect(msgs(base).join()).toMatch(/needs an upstream Asset with propose/)
    const lib = base.nodes[1] as { access: string }
    lib.access = "propose"
    expect(msgs(base)).toEqual([])
    // The Asset must be upstream, not just in the graph.
    expect(msgs({ ...base, edges: [] }).join()).toMatch(
      /needs an upstream Asset/
    )
    // And it must reach the same connection.
    const other = {
      ...base,
      nodes: [
        base.nodes[0],
        {
          ...lib,
          resources: [{ connection: "other", entity: "item", id: "v1" }],
        },
        base.nodes[2],
      ],
    }
    expect(msgs(other).join()).toMatch(/needs an upstream Asset/)
    const noConn = {
      ...base,
      nodes: [
        base.nodes[0],
        lib,
        { id: "o", kind: "output", target: "publish" },
      ],
    }
    expect(msgs(noConn).join()).toMatch(/publish needs a connection/)
    const folderConn = {
      ...base,
      nodes: [
        base.nodes[0],
        lib,
        { id: "o", kind: "output", target: "folder", connection: "demo" },
      ],
    }
    expect(msgs(folderConn).join()).toMatch(/only for the publish target/)
  })

  it("start fails for a read-only or unknown connection", () => {
    const home = tempDir("flowapp-outpub-valid-")
    fakeConn(home, "demo", {}, "read-only")
    expect(() => assertNodePublishValid(home, wf(["demo"]))).toThrow(
      /read-only/
    )
    expect(() => assertNodePublishValid(home, wf(["nope"]))).toThrow(
      /unknown connection/
    )
    const engine = createEngine({ home })
    expect(() => engine.startNodeRun({ graph: wf(["demo"]) })).toThrow(
      /read-only/
    )
    engine.close()
  })
})

describe("output publish (fake connector)", () => {
  it("waits for approval, publishes from the step and writes result.json", async () => {
    const home = tempDir("flowapp-outpub-")
    fakeConn(home, "demo")
    const s = await start(home, wf())
    await until(() => s.status("ship-demo") === "waiting")
    const asked = types(s.events(), "approval_requested").at(-1)
    expect(asked).toMatchObject({
      taskId: "ship-demo",
      nodeId: "ship-demo",
      question: "Publish 1 change to demo?",
    })
    expect(types(s.events(), "publish_started")).toHaveLength(0)
    expect(existsSync(join(s.runRoot, "changes/ship-demo/preview.md"))).toBe(
      true
    )
    // The agent step worked in the work copy; the pinned copy is untouched.
    expect(
      readFileSync(join(s.runRoot, "work/demo/item/v1/data.txt"), "utf8")
    ).toBe("changed\n")

    approve(s, "ship-demo")
    await s.done
    const events = s.events()
    expect(events.at(-1)?.type).toBe("run_succeeded")
    expect(types(events, "publish_finished")).toMatchObject([
      { taskId: "ship-demo", status: "applied", impact: "cloud" },
    ])
    const result = JSON.parse(
      readFileSync(
        join(s.runRoot, "nodes/ship-demo/pass-1/result.json"),
        "utf8"
      )
    ) as { url: string }
    expect(result.url).toMatch(/example\.test/)
    expect(latestStep(foldSteps(events), "ship-demo")?.outputs).toEqual([
      "nodes/ship-demo/pass-1/result.json",
    ])
    // The base moved to the published state: nothing is left unpublished.
    expect(existsSync(join(s.runRoot, "publish-base/demo"))).toBe(true)
    expect(types(events, "work_copy_changed")).toHaveLength(0)
  }, 30_000)

  it("reject ends the run without publishing", async () => {
    const home = tempDir("flowapp-outpub-rej-")
    fakeConn(home, "demo")
    const s = await start(home, wf())
    await until(() => s.status("ship-demo") === "waiting")
    rejectNodeStep(s.log, "r1", "ship-demo")
    s.host().wake()
    await s.done
    expect(s.events().at(-1)?.type).toBe("run_cancelled")
    expect(types(s.events(), "publish_started")).toHaveLength(0)
  }, 30_000)

  it("an empty change set succeeds and sends nothing", async () => {
    const home = tempDir("flowapp-outpub-empty-")
    fakeConn(home, "demo")
    const s = await start(home, wf(["demo"], "true"))
    await s.done
    expect(s.events().at(-1)?.type).toBe("run_succeeded")
    expect(types(s.events(), "publish_started")).toHaveLength(0)
    expect(s.status("ship-demo")).toBe("done")
  }, 30_000)

  it("destructive ops wait even without the approve-each policy", async () => {
    const home = tempDir("flowapp-outpub-destr-")
    // trust-agent-review would run a CLI; destructive skips it and escalates.
    const made = createConnection(home, {
      id: "demo",
      connector: "fake",
      name: "demo",
      scope: { label: "v1" },
      signIn: "cli",
      refresh: "1h",
      policy: "trust-agent-review",
    })
    expect(made.ok).toBe(true)
    const s = await start(
      home,
      wf(
        ["demo"],
        `printf '__destructive__' > "$RESOURCE_DEMO/item/v1/wipe.destructive"`
      )
    )
    await until(() => s.status("ship-demo") === "waiting")
    expect(types(s.events(), "agent_review_finished")).toMatchObject([
      { verdict: "escalate", reason: "destructive" },
    ])
    expect(types(s.events(), "publish_started")).toHaveLength(0)
    approve(s, "ship-demo")
    await s.done
    expect(s.events().at(-1)?.type).toBe("run_succeeded")
  }, 30_000)

  it("conflict and remote rejection fail the step with that reason", async () => {
    for (const mode of ["conflict", "rejected"] as const) {
      const home = tempDir("flowapp-outpub-fail-")
      fakeConn(home, "demo", { publishResult: mode })
      const s = await start(home, wf())
      await until(() => s.status("ship-demo") === "waiting")
      approve(s, "ship-demo")
      await s.done
      const step = latestStep(foldSteps(s.events()), "ship-demo")
      expect(step?.status).toBe("failed")
      expect(step?.failReason).toBe(mode)
      expect(s.events().at(-1)?.type).toBe("run_failed")
    }
  }, 40_000)

  it("several Output nodes each run on their own", async () => {
    const home = tempDir("flowapp-outpub-two-")
    fakeConn(home, "demo-a")
    fakeConn(home, "demo-b")
    const s = await start(home, wf(["demo-a", "demo-b"]))
    await until(
      () =>
        s.status("ship-demo-a") === "waiting" &&
        s.status("ship-demo-b") === "waiting"
    )
    approve(s, "ship-demo-a")
    await until(() => s.status("ship-demo-a") === "done")
    expect(s.status("ship-demo-b")).toBe("waiting")
    expect(
      types(s.events(), "publish_finished").map((e) => e.connection)
    ).toEqual(["demo-a"])
    approve(s, "ship-demo-b")
    await s.done
    expect(s.events().at(-1)?.type).toBe("run_succeeded")
    expect(
      types(s.events(), "publish_finished").map((e) => e.connection)
    ).toEqual(["demo-a", "demo-b"])
  }, 40_000)

  it("a waiting publish survives a restart", async () => {
    const home = tempDir("flowapp-outpub-resume-")
    fakeConn(home, "demo")
    const s = await start(home, wf())
    await until(() => s.status("ship-demo") === "waiting")
    approveNodeStep(s.log, "r1", "ship-demo")
    // New driver, as after a restart: the approved step publishes.
    await resumeNodes({ log: s.log, home, runId: "r1" })
    expect(s.events().at(-1)?.type).toBe("run_succeeded")
    expect(types(s.events(), "publish_finished")).toHaveLength(1)
  }, 30_000)

  it("a crash between publish_started and publish_finished resumes through the receipt", async () => {
    const home = tempDir("flowapp-outpub-crash-")
    fakeConn(home, "demo")
    const s = await start(home, wf())
    await until(() => s.status("ship-demo") === "waiting")
    const stored = JSON.parse(
      readFileSync(join(s.runRoot, "changes/ship-demo/changeset.json"), "utf8")
    )
    // The connector applied the change, then the process died.
    const conn = {
      id: "demo",
      connector: "fake",
      name: "demo",
      scope: { label: "v1" },
      signIn: "cli" as const,
      refresh: "1h" as const,
      policy: "approve-each-publish" as const,
      serial: false,
    }
    const first = await fakeConnector.publish(conn, stored, home, {
      runRoot: s.runRoot,
    })
    approveNodeStep(s.log, "r1", "ship-demo")
    s.log.append({
      type: "publish_started",
      runId: "r1",
      taskId: "ship-demo",
      connection: "demo",
      at: new Date().toISOString(),
    })
    await resumeNodes({ log: s.log, home, runId: "r1" })

    const events = s.events()
    expect(events.at(-1)?.type).toBe("run_succeeded")
    const finished = types(events, "publish_finished")
    expect(finished).toHaveLength(1)
    // Same receipt: the connector did not send a second time.
    expect(finished[0]).toMatchObject({ status: "applied" })
    expect(
      first.status === "applied" && "result" in finished[0]!
        ? finished[0]!.result
        : undefined
    ).toEqual(first.status === "applied" ? first.result : undefined)
    expect(types(events, "publish_started")).toHaveLength(1)
  }, 30_000)

  it("a crash with no stored change set fails the step as rejected", async () => {
    const home = tempDir("flowapp-outpub-crash2-")
    fakeConn(home, "demo")
    const s = await start(home, wf())
    await until(() => s.status("ship-demo") === "waiting")
    rmSync(join(s.runRoot, "changes/ship-demo"), { recursive: true })
    approveNodeStep(s.log, "r1", "ship-demo")
    s.log.append({
      type: "publish_started",
      runId: "r1",
      taskId: "ship-demo",
      connection: "demo",
      at: new Date().toISOString(),
    })
    await resumeNodes({ log: s.log, home, runId: "r1" })
    expect(latestStep(foldSteps(s.events()), "ship-demo")?.failReason).toBe(
      "rejected"
    )
  }, 30_000)

  it("changes left in a work copy with no Output stay Local", async () => {
    const home = tempDir("flowapp-outpub-local-")
    fakeConn(home, "demo")
    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "lib",
          kind: "asset",
          access: "propose",
          resources: [{ connection: "demo", entity: "item", id: "v1" }],
        },
        {
          id: "edit",
          kind: "command",
          run: 'echo hi > "$RESOURCE_DEMO/item/v1/data.txt"',
        },
      ],
      edges: [
        { from: "t", to: "edit" },
        { from: "lib", to: "edit" },
      ],
    })
    const engine = createEngine({ home })
    const runId = "r1"
    const pins = await engine.pinNodeRun({ graph, runId })
    await engine.startNodeRun({ graph, runId, pins }).wait()
    expect(
      engine.events(runId).filter((e) => e.type === "work_copy_changed")
    ).toMatchObject([{ connection: "demo", impact: "local", opCount: 1 }])
    engine.close()
  }, 30_000)
})

describe("output publish (GitHub fixture)", () => {
  it("opens a draft PR from the work copy and records the URL", async () => {
    const root = tempDir("flowapp-outpub-gh-")
    const work = join(root, "work")
    const bare = join(root, "remote.git")
    await runGit(["init", "-b", "main", work])
    writeFileSync(join(work, "README.md"), "hello\n")
    await runGit(["-C", work, "add", "README.md"])
    await runGit(["-C", work, "config", "user.email", "t@example.com"])
    await runGit(["-C", work, "config", "user.name", "Test"])
    await runGit(["-C", work, "commit", "-m", "init"])
    await runGit(["clone", "--bare", work, bare])

    const prUrl = "https://github.com/acme/demo/pull/7"
    // A stub `gh`: nothing leaves the machine; the remote is the local bare repo.
    const runGh = async (args: string[]): Promise<CommandResult> => {
      if (args[0] === "auth") {
        return {
          stdout: "",
          stderr: "Logged in to github.com account test",
          code: 0,
        }
      }
      if (args[0] === "pr" && args[1] === "create") {
        return { stdout: `${prUrl}\n`, stderr: "", code: 0 }
      }
      if (args[0] === "repo" && args[1] === "view") {
        return { stdout: "main\n", stderr: "", code: 0 }
      }
      return { stdout: "", stderr: "", code: 0 }
    }
    clearConnectors()
    registerConnector(createGithubConnector({ runGh, runGit }))

    const home = tempDir("flowapp-outpub-gh-home-")
    const made = createConnection(home, {
      id: "github-demo",
      connector: "github",
      name: "Demo",
      scope: { owner: "acme", name: "demo", remote: bare },
      signIn: "cli",
      refresh: "never",
      policy: "approve-each-publish",
    })
    expect(made.ok).toBe(true)

    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "repo",
          kind: "asset",
          access: "propose",
          resources: [
            { connection: "github-demo", entity: "repo", id: "acme/demo" },
          ],
        },
        {
          id: "edit",
          kind: "command",
          run: 'git -C "$RESOURCE_GITHUB_DEMO/repo/acme%2Fdemo" config user.email t@example.com; git -C "$RESOURCE_GITHUB_DEMO/repo/acme%2Fdemo" config user.name T; echo shipped > "$RESOURCE_GITHUB_DEMO/repo/acme%2Fdemo/feature.txt"',
        },
        {
          id: "pr",
          kind: "output",
          target: "publish",
          connection: "github-demo",
        },
      ],
      edges: [
        { from: "t", to: "edit" },
        { from: "repo", to: "edit" },
        { from: "edit", to: "pr" },
      ],
    })
    const s = await start(home, graph)
    await until(() => s.status("pr") === "waiting")
    expect(
      readFileSync(join(s.runRoot, "changes/pr/preview.md"), "utf8")
    ).toMatch(/flows\/r1\/pr/)
    approve(s, "pr")
    await s.done
    expect(s.events().at(-1)?.type).toBe("run_succeeded")
    const result = JSON.parse(
      readFileSync(join(s.runRoot, "nodes/pr/pass-1/result.json"), "utf8")
    ) as { url: string; branch: string }
    expect(result).toEqual({ branch: "flows/r1/pr", url: prUrl })
    expect(
      (await runGit(["ls-remote", bare, "refs/heads/flows/r1/pr"])).trim()
    ).toMatch(/^[0-9a-f]+/)
  }, 60_000)
})
