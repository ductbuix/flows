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
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { CrashError } from "./tick.ts"
import { resumeNodes, runNodes } from "./drive.ts"

const homes: string[] = []
const prevPath = process.env.PATH
const prevBackoff = process.env.FLOWAPP_RETRY_BACKOFF_MS
const prevCursor = process.env.FLOWAPP_CURSOR_PROJECTS

beforeEach(() => {
  process.env.FLOWAPP_RETRY_BACKOFF_MS = "10"
})
afterEach(() => {
  process.env.PATH = prevPath
  if (prevBackoff === undefined) delete process.env.FLOWAPP_RETRY_BACKOFF_MS
  else process.env.FLOWAPP_RETRY_BACKOFF_MS = prevBackoff
  if (prevCursor === undefined) delete process.env.FLOWAPP_CURSOR_PROJECTS
  else process.env.FLOWAPP_CURSOR_PROJECTS = prevCursor
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

function setup(files: Record<string, string> = {}) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-proc-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(wf, rel, ".."), { recursive: true })
    writeFileSync(join(wf, rel), text)
  }
  return { home, wf, log: new EventLog(appDbPath(home)) }
}

/** Stub `claude`: dumps its env, writes SUMMARY.md, then sleeps. */
function stubClaude(home: string, sleep = 0): void {
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const script = [
    "#!/bin/sh",
    'env | grep "^NODE_" | sort > "$NODE_OUT/env.txt"',
    'printf "%s" "$NODE_INSTRUCTIONS" > "$NODE_OUT/instructions.txt"',
    'cp "$NODE_IN/text.md" "$NODE_OUT/in.md"',
    'echo "summary of $NODE_ID" > SUMMARY.md',
    sleep > 0 ? `sleep ${sleep}` : "",
    "exit 0",
    "",
  ].join("\n")
  writeFileSync(join(bin, "claude"), script, { mode: 0o755 })
  writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
}

const events = (log: EventLog, runId: string): EngineEvent[] =>
  log.listByRun(runId).map((s) => s.event)

const read = (home: string, runId: string, rel: string) =>
  readFileSync(join(runDir(workflowDir(home, "wf"), runId), rel), "utf8")

describe("agent and command executors", () => {
  it("joins input, exports NODE_* env and passes files downstream", async () => {
    const { home, log } = setup({
      "nodes/rules/text.md": "be terse",
      "nodes/plan/prompt.md": "Plan the work.",
    })
    stubClaude(home)
    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "rules", name: "House rules", kind: "prompt" },
        { id: "plan", kind: "agent", cli: "claude" },
        {
          id: "build",
          kind: "command",
          run: 'cat "$NODE_IN/text.md" > "$NODE_OUT/joined.md"; printf "%s" "$UPSTREAM_plan" > "$NODE_OUT/upstream.txt"; ls "$NODE_IN/files/plan" > "$NODE_OUT/files.txt"; echo built',
        },
        { id: "o", kind: "output", target: "folder" },
      ],
      edges: [
        { from: "t", to: "plan" },
        { from: "rules", to: "plan" },
        { from: "plan", to: "build" },
        { from: "build", to: "o" },
      ],
    })
    const state = await runNodes({
      log,
      home,
      runId: "r1",
      graph,
      inputText: "story",
    })
    expect(state.ended).toBe(true)
    expect(events(log, "r1").at(-1)?.type).toBe("run_succeeded")

    // Agent: joined input in edge order, headed by source name.
    const dir = "nodes/plan/pass-1/attempt-1"
    expect(read(home, "r1", `${dir}/out/in.md`)).toBe(
      "## t\n\nstory\n\n## House rules\n\nbe terse\n"
    )
    const env = read(home, "r1", `${dir}/out/env.txt`)
    expect(env).toContain("NODE_ID=plan")
    expect(env).toContain(`NODE_IN=`)
    expect(env).toContain(`${dir}/out`)
    expect(read(home, "r1", `${dir}/out/instructions.txt`)).toMatch(
      /nodes\/plan\/pass-1\/attempt-1\/input\/prompt\.md$/
    )
    // The agent's SUMMARY.md is the step text and out/ the step files.
    expect(read(home, "r1", "nodes/plan/pass-1/text.md")).toBe(
      "summary of plan\n"
    )
    // Command: input files linked, UPSTREAM_<id> set, stdout is the text.
    const cmd = "nodes/build/pass-1/attempt-1/out"
    expect(read(home, "r1", `${cmd}/joined.md`)).toBe(
      "## plan\n\nsummary of plan\n"
    )
    expect(read(home, "r1", `${cmd}/upstream.txt`)).toMatch(
      /nodes\/plan\/pass-1\/files$/
    )
    expect(read(home, "r1", `${cmd}/files.txt`)).toContain("in.md")
    expect(read(home, "r1", "nodes/build/pass-1/text.md")).toBe("built\n")
    expect(read(home, "r1", "output/build/files/joined.md")).toContain("plan")
    log.close()
  })

  it("retries a failed attempt in the same pass and sees PREV_ATTEMPT", async () => {
    const { home, log } = setup()
    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "flaky",
          kind: "command",
          retry: { max: 3 },
          run: 'if [ -z "$PREV_ATTEMPT" ]; then exit 1; fi; printf "%s" "$PREV_ATTEMPT" > "$NODE_OUT/prev.txt"',
        },
      ],
      edges: [{ from: "t", to: "flaky" }],
    })
    const state = await runNodes({ log, home, runId: "r1", graph })
    expect(state.steps.flaky![0]!.attempts).toBe(2)
    expect(state.steps.flaky![0]!.status).toBe("done")
    const types = events(log, "r1").map((e) => e.type)
    expect(types.filter((x) => x === "attempt_started")).toHaveLength(2)
    expect(read(home, "r1", "nodes/flaky/pass-1/files/prev.txt")).toMatch(
      /attempt-1$/
    )
    log.close()
  })

  it("fails the step when retries run out, and on timeout", async () => {
    const { home, log } = setup()
    const graph = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "bad", kind: "command", retry: { max: 2 }, run: "exit 3" },
        { id: "slow", kind: "command", timeout: 1, run: "sleep 30" },
      ],
      edges: [
        { from: "t", to: "bad" },
        { from: "t", to: "slow" },
      ],
    })
    const state = await runNodes({ log, home, runId: "r1", graph })
    expect(state.steps.bad![0]!.status).toBe("failed")
    expect(state.steps.bad![0]!.attempts).toBe(2)
    expect(state.steps.bad![0]!.failReason).toBe("exit")
    expect(state.steps.slow![0]!.failReason).toBe("timeout")
    expect(events(log, "r1").at(-1)?.type).toBe("run_failed")
    log.close()
  }, 15_000)

  it("counts agent steps against limits.agents; commands hold no slot", async () => {
    const { home, log } = setup({
      "nodes/a1/prompt.md": "one",
      "nodes/a2/prompt.md": "two",
    })
    stubClaude(home, 0.4)
    const graph = workflowSchema.parse({
      id: "wf",
      limits: { agents: 1 },
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "a1", kind: "agent", cli: "claude" },
        { id: "a2", kind: "agent", cli: "claude" },
        { id: "c", kind: "command", run: "true" },
      ],
      edges: [
        { from: "t", to: "a1" },
        { from: "t", to: "a2" },
        { from: "t", to: "c" },
      ],
    })
    const state = await runNodes({ log, home, runId: "r1", graph })
    expect(state.ended).toBe(true)
    const list = events(log, "r1")
    const at = (type: string, node: string) =>
      list.findIndex(
        (e) => e.type === type && "nodeId" in e && e.nodeId === node
      )
    // One agent at a time: the second starts after the first finished.
    const first = at("attempt_started", "a1") < at("attempt_started", "a2")
    const [early, late] = first ? ["a1", "a2"] : ["a2", "a1"]
    expect(at("attempt_started", late)).toBeGreaterThan(
      at("attempt_finished", early)
    )
    // The command ran while the first agent still held the slot.
    expect(at("attempt_started", "c")).toBeLessThan(
      at("attempt_finished", early)
    )
    expect(events(log, "r1").at(-1)?.type).toBe("run_succeeded")
    log.close()
  }, 15_000)
})

describe("resume", () => {
  const graph = (retry?: number) =>
    workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        {
          id: "work",
          kind: "command",
          ...(retry ? { retry: { max: retry } } : {}),
          run: 'sleep 1; printf done > "$NODE_OUT/r.txt"',
        },
      ],
      edges: [{ from: "t", to: "work" }],
    })

  it("re-attaches to a live attempt after a crash", async () => {
    const { home, log } = setup()
    const crashAt = (p: string) => {
      if (p === "after_attempt_launched") throw new CrashError("crash")
    }
    await expect(
      runNodes({ log, home, runId: "r1", graph: graph(), crashAt })
    ).rejects.toThrow(CrashError)
    expect(
      events(log, "r1").some(
        (e) => e.type === "step_done" && e.nodeId === "work"
      )
    ).toBe(false)

    const state = await resumeNodes({ log, home, runId: "r1" })
    expect(state.ended).toBe(true)
    const types = events(log, "r1").map((e) => e.type)
    expect(types.filter((x) => x === "attempt_started")).toHaveLength(1)
    expect(types).not.toContain("attempt_interrupted")
    expect(types.at(-1)).toBe("run_succeeded")
    expect(read(home, "r1", "nodes/work/pass-1/files/r.txt")).toBe("done")
    log.close()
  }, 15_000)

  it("records an interrupt when nothing can be re-attached, then retries", async () => {
    const { home, log } = setup()
    const crashAt = (p: string) => {
      if (p === "after_attempt_started") throw new CrashError("crash")
    }
    await expect(
      runNodes({ log, home, runId: "r1", graph: graph(2), crashAt })
    ).rejects.toThrow(CrashError)

    const state = await resumeNodes({ log, home, runId: "r1" })
    expect(state.ended).toBe(true)
    const types = events(log, "r1").map((e) => e.type)
    expect(types).toContain("attempt_interrupted")
    expect(types.filter((x) => x === "attempt_started")).toHaveLength(2)
    expect(types.at(-1)).toBe("run_succeeded")
    expect(
      existsSync(
        join(
          runDir(workflowDir(home, "wf"), "r1"),
          "nodes/work/pass-1/attempt-2"
        )
      )
    ).toBe(true)
    log.close()
  }, 15_000)

  it("fails the step on an interrupt when no retry is set", async () => {
    const { home, log } = setup()
    const crashAt = (p: string) => {
      if (p === "after_attempt_started") throw new CrashError("crash")
    }
    await expect(
      runNodes({ log, home, runId: "r1", graph: graph(), crashAt })
    ).rejects.toThrow(CrashError)
    const state = await resumeNodes({ log, home, runId: "r1" })
    expect(state.steps.work![0]!.status).toBe("failed")
    expect(events(log, "r1").at(-1)?.type).toBe("run_failed")
    log.close()
  }, 15_000)
})
