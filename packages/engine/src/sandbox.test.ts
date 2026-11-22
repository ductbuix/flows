import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
import { cookiesPath, writeCookies } from "./secrets.ts"
import {
  buildSandboxSpawn,
  canApplySandbox,
  sandboxSecretsRoot,
  sandboxWriteRoot,
} from "./sandbox.ts"

const homes: string[] = []
const engines: Array<{ close: () => void }> = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  delete process.env.FLOWAPP_SANDBOX
  clearConnectors()
  for (const engine of engines.splice(0)) {
    engine.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-sandbox-"))
  homes.push(home)
  return home
}

describe("sandbox helpers", () => {
  it("respects FLOWAPP_SANDBOX=0 fallback", () => {
    process.env.FLOWAPP_SANDBOX = "0"
    expect(canApplySandbox()).toBe(false)
    const spawn = buildSandboxSpawn("echo hi", tempHome())
    expect(spawn.sandboxed).toBe(false)
    expect(spawn.command).toBe("/bin/sh")
  })

  it("wraps with sandbox-exec on macOS when enabled", () => {
    if (process.platform !== "darwin") return
    const home = tempHome()
    const spawn = buildSandboxSpawn("echo hi", home)
    expect(spawn.sandboxed).toBe(true)
    if (spawn.sandboxed) {
      expect(spawn.command).toBe("/usr/bin/sandbox-exec")
      expect(spawn.args).toContain(`WF_DIR=${sandboxWriteRoot(home)}`)
    }
  })
})

const shq = (path: string) => path.replaceAll("'", "'\\''")

/** Independent command nodes off one Trigger, plus an optional read Asset. */
function graphOf(
  id: string,
  commands: Record<string, string>,
  asset?: { connection: string; id: string }
) {
  const nodes: object[] = [{ id: "t", kind: "trigger", type: "manual" }]
  const edges: object[] = []
  if (asset) {
    nodes.push({
      id: "lib",
      kind: "asset",
      resources: [
        { connection: asset.connection, entity: "item", id: asset.id },
      ],
    })
  }
  for (const [nodeId, run] of Object.entries(commands)) {
    nodes.push({ id: nodeId, kind: "command", run })
    edges.push({ from: "t", to: nodeId })
    if (asset) edges.push({ from: "lib", to: nodeId })
  }
  return workflowSchema.parse({ id, nodes, edges })
}

async function runGraph(home: string, graph: ReturnType<typeof graphOf>) {
  const engine = createEngine({ home })
  engines.push(engine)
  const pins = await engine.pinNodeRun({ graph, runId: "r1" })
  const state = await engine.startNodeRun({ graph, runId: "r1", pins }).wait()
  return { engine, state, root: runDir(workflowDir(home, graph.id), "r1") }
}

describe("sandbox write boundary", () => {
  it("allows writes inside the workflow dir and blocks outside", async () => {
    if (!canApplySandbox()) return

    const home = tempHome()
    const outside = join(home, "outside")
    mkdirSync(outside, { recursive: true })
    const outsideFile = join(outside, "bad.txt")
    const graph = graphOf("sandbox-boundary", {
      inside: 'printf ok > "$NODE_OUT/ok.txt"',
      outside: `printf bad > '${shq(outsideFile)}'`,
    })
    const { engine, state, root } = await runGraph(home, graph)

    expect(state.tasks.inside?.status).toBe("succeeded")
    expect(state.tasks.outside?.status).toBe("failed")
    expect(state.sandboxed).toBe(true)
    expect(
      readFileSync(
        join(root, "nodes", "inside", "pass-1", "attempt-1", "out", "ok.txt"),
        "utf8"
      )
    ).toBe("ok")
    expect(() => readFileSync(outsideFile)).toThrow()

    const launched = engine
      .events("r1")
      .filter((e) => e.type === "attempt_launched")
    expect(launched.every((e) => e.sandboxed === true)).toBe(true)
  })

  it("marks the run unsandboxed when sandbox is forced off", async () => {
    process.env.FLOWAPP_SANDBOX = "0"
    const home = tempHome()
    const graph = graphOf("no-sandbox", { a: 'printf x > "$NODE_OUT/x.txt"' })
    const { state } = await runGraph(home, graph)

    expect(state.status).toBe("succeeded")
    expect(state.sandboxed).toBe(false)
  })

  it("denies sandboxed steps from reading secrets/cookies.json", async () => {
    if (!canApplySandbox()) return

    const home = tempHome()
    writeCookies(home, "rally-payments", [
      {
        name: "sid",
        value: "sandbox-secret-cookie",
        domain: "example.com",
        path: "/",
      },
    ])
    const cookieFile = cookiesPath(home, "rally-payments")
    const graph = graphOf("secrets-deny", {
      "read-secret": `cat '${shq(cookieFile)}' > "$NODE_OUT/leak.txt"`,
    })
    const { state, root } = await runGraph(home, graph)

    expect(state.tasks["read-secret"]?.status).toBe("failed")
    expect(state.sandboxed).toBe(true)
    const attempt = join(root, "nodes", "read-secret", "pass-1", "attempt-1")
    // Redirect may create an empty file before cat is denied.
    const leakPath = join(attempt, "out", "leak.txt")
    if (existsSync(leakPath)) {
      expect(readFileSync(leakPath, "utf8")).not.toContain(
        "sandbox-secret-cookie"
      )
    }
    expect(readFileSync(join(attempt, "stderr.log"), "utf8")).toMatch(
      /Operation not permitted|Permission denied/
    )

    const wf = workflowDir(home, "secrets-deny")
    const spawn = buildSandboxSpawn("true", wf)
    expect(spawn.sandboxed).toBe(true)
    if (spawn.sandboxed) {
      expect(spawn.args).toContain(`SECRETS_DIR=${sandboxSecretsRoot(wf)}`)
    }
  })
})

describe("sandbox library boundary", () => {
  it("allows reading resources/ and blocks writes under library/", async () => {
    if (!canApplySandbox()) return

    const home = tempHome()
    createConnection(home, {
      id: "demo",
      connector: "fake",
      name: "demo",
      scope: { label: "z" },
      signIn: "cli",
      refresh: "never",
    })
    const libraryFile = join(home, "library", "should-not-write.txt")
    const graph = graphOf(
      "lib-sandbox",
      {
        read: 'test -f "$RESOURCE_DEMO/item/z/data.txt" && printf ok > "$NODE_OUT/ok.txt"',
        "write-lib": `printf bad > '${shq(libraryFile)}'`,
      },
      { connection: "demo", id: "z" }
    )
    const { state } = await runGraph(home, graph)

    expect(state.tasks.read?.status).toBe("succeeded")
    expect(state.tasks["write-lib"]?.status).toBe("failed")
    expect(state.sandboxed).toBe(true)
    expect(() => readFileSync(libraryFile)).toThrow()
  })
})
