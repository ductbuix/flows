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
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"

const homes: string[] = []
const prevPath = process.env.PATH
const prevBackoff = process.env.FLOWAPP_RETRY_BACKOFF_MS
const prevCursorProjects = process.env.FLOWAPP_CURSOR_PROJECTS

afterEach(() => {
  process.env.PATH = prevPath
  if (prevBackoff === undefined) delete process.env.FLOWAPP_RETRY_BACKOFF_MS
  else process.env.FLOWAPP_RETRY_BACKOFF_MS = prevBackoff
  if (prevCursorProjects === undefined) {
    delete process.env.FLOWAPP_CURSOR_PROJECTS
  } else {
    process.env.FLOWAPP_CURSOR_PROJECTS = prevCursorProjects
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-"))
  homes.push(home)
  process.env.FLOWAPP_CURSOR_PROJECTS = join(home, ".cursor-projects")
  return home
}

/** Stub `claude` / `agent` on PATH that can spawn YAML or sleep. */
function installStubBin(
  home: string,
  opts: {
    name: "claude" | "agent"
    spawnYaml?: string
    sleepMs?: number
    writeMarker?: string
  }
): void {
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const marker = opts.writeMarker
    ? `printf 'ran' > "${opts.writeMarker}"\n`
    : ""
  const spawn = opts.spawnYaml
    ? `mkdir -p out/spawn\ncat > out/spawn/child.yaml << 'YAML'\n${opts.spawnYaml}\nYAML\n`
    : ""
  const sleep =
    opts.sleepMs !== undefined ? `sleep ${opts.sleepMs / 1000}\n` : ""
  const script = `#!/bin/sh\n${marker}${spawn}${sleep}exit 0\n`
  const path = join(bin, opts.name)
  writeFileSync(path, script, { mode: 0o755 })
  // Cursor adapter invokes `agent`.
  if (opts.name === "claude") {
    writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  }
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
}

describe("agent tasks and spawn", () => {
  it("runs a Claude agent, copies memory, and spawns a child task", async () => {
    const home = tempHome()
    process.env.FLOWAPP_RETRY_BACKOFF_MS = "10"
    const wf = join(home, "workflows", "research")
    mkdirSync(join(wf, "memory"), { recursive: true })
    mkdirSync(join(wf, "tasks"), { recursive: true })
    writeFileSync(join(wf, "memory", "style.md"), "# terse\n")
    writeFileSync(join(wf, "tasks", "plan.md"), "Plan the work.\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: research
limits: { agents: 2, maxTasks: 20, maxSpawnDepth: 2 }
tasks:
  - id: plan
    kind: agent
    cli: claude
    instructions: tasks/plan.md
    memory: [memory/style.md]
    spawn: true
`
    )
    installStubBin(home, {
      name: "claude",
      spawnYaml:
        'id: fetch\nkind: command\nrun: "printf ok > \\"$TASK_OUT/done.txt\\""\nneeds: [plan]\n',
    })

    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir: wf, runId: "r1", trustGrant: "once" })
    const state = await handle.wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.plan?.status).toBe("succeeded")
    expect(state.tasks.fetch?.status).toBe("succeeded")
    expect(state.graph.tasks.find((t) => t.id === "fetch")?.spawnedBy).toBe(
      "plan"
    )

    const memory = readFileSync(
      join(wf, "runs", "r1", "tasks", "plan", "input", "memory", "style.md"),
      "utf8"
    )
    expect(memory).toBe("# terse\n")

    const graph = JSON.parse(
      readFileSync(join(wf, "runs", "r1", "graph.json"), "utf8")
    ) as { tasks: Array<{ id: string }> }
    expect(graph.tasks.map((t) => t.id)).toContain("fetch")

    const out = readFileSync(
      join(wf, "runs", "r1", "tasks", "fetch", "latest", "out", "done.txt"),
      "utf8"
    )
    expect(out).toBe("ok")

    const events = engine.events("r1")
    expect(events.some((e) => e.type === "tasks_spawned")).toBe(true)
    engine.close()
  }, 20_000)

  it("feeds spawn rejections back and retries when retry is set", async () => {
    const home = tempHome()
    process.env.FLOWAPP_RETRY_BACKOFF_MS = "10"
    const wf = join(home, "workflows", "bad-spawn")
    mkdirSync(join(wf, "tasks"), { recursive: true })
    writeFileSync(join(wf, "tasks", "plan.md"), "Spawn a bad id.\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: bad-spawn
tasks:
  - id: plan
    kind: agent
    cli: claude
    instructions: tasks/plan.md
    spawn: true
    retry: { max: 2 }
`
    )
    // First attempt writes duplicate id; second writes nothing (succeed).
    const bin = join(home, "bin")
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, "claude"),
      `#!/bin/sh
MARKER="$TASK_IN/.attempt"
if [ ! -f "$MARKER" ]; then
  printf '1' > "$MARKER"
  mkdir -p out/spawn
  printf 'id: plan\\nkind: command\\nrun: echo x\\n' > out/spawn/dup.yaml
else
  rm -f out/spawn/*.yaml 2>/dev/null || true
fi
exit 0
`,
      { mode: 0o755 }
    )
    process.env.PATH = `${bin}:${process.env.PATH ?? ""}`

    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir: wf, runId: "r2", trustGrant: "once" })
    const state = await handle.wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.plan?.attempts.length).toBeGreaterThanOrEqual(2)
    expect(
      existsSync(
        join(wf, "runs", "r2", "tasks", "plan", "input", "spawn-rejections.md")
      )
    ).toBe(true)
    engine.close()
  }, 20_000)

  it("applies agents limit so only N agents run at once", async () => {
    const home = tempHome()
    process.env.FLOWAPP_RETRY_BACKOFF_MS = "10"
    writeFileSync(join(home, "config.yaml"), "limits:\n  agents: 1\n")
    const wf = join(home, "workflows", "parallel-agents")
    mkdirSync(join(wf, "tasks"), { recursive: true })
    writeFileSync(join(wf, "tasks", "a.md"), "A\n")
    writeFileSync(join(wf, "tasks", "b.md"), "B\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: parallel-agents
limits: { agents: 1 }
tasks:
  - id: a
    kind: agent
    cli: claude
    instructions: tasks/a.md
  - id: b
    kind: agent
    cli: claude
    instructions: tasks/b.md
`
    )
    installStubBin(home, { name: "claude", sleepMs: 200 })

    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir: wf, runId: "r3", trustGrant: "once" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")

    const events = engine.events("r3")
    const aLaunch = events.findIndex(
      (e) => e.type === "attempt_launched" && e.taskId === "a"
    )
    const bLaunch = events.findIndex(
      (e) => e.type === "attempt_launched" && e.taskId === "b"
    )
    const aDone = events.findIndex(
      (e) => e.type === "attempt_finished" && e.taskId === "a"
    )
    const bDone = events.findIndex(
      (e) => e.type === "attempt_finished" && e.taskId === "b"
    )
    // With agents: 1, the second launch must happen after the first finishes.
    const firstDone = Math.min(aDone, bDone)
    const secondLaunch = Math.max(aLaunch, bLaunch)
    expect(secondLaunch).toBeGreaterThan(firstDone)
    engine.close()
  }, 20_000)

  it("sets TASK_INSTRUCTIONS for the agent process", async () => {
    const home = tempHome()
    const wf = join(home, "workflows", "env-check")
    mkdirSync(join(wf, "tasks"), { recursive: true })
    writeFileSync(join(wf, "tasks", "plan.md"), "Check env.\n")
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: env-check
tasks:
  - id: plan
    kind: agent
    cli: cursor
    instructions: tasks/plan.md
`
    )
    const bin = join(home, "bin")
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, "agent"),
      `#!/bin/sh
printf '%s' "$TASK_INSTRUCTIONS" > out/instructions-path.txt
exit 0
`,
      { mode: 0o755 }
    )
    process.env.PATH = `${bin}:${process.env.PATH ?? ""}`

    const engine = createEngine({ home })
    const handle = engine.startRun({ workflowDir: wf, runId: "r4", trustGrant: "once" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    const path = readFileSync(
      join(
        wf,
        "runs",
        "r4",
        "tasks",
        "plan",
        "latest",
        "out",
        "instructions-path.txt"
      ),
      "utf8"
    )
    expect(path).toBe(join(wf, "tasks", "plan.md"))
    engine.close()
  }, 20_000)
})
