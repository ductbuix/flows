import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { nodeWorkflowSchema, type EngineEvent } from "@workspace/shared"
import { getCliAdapter } from "../cli-adapters.ts"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { runNodes } from "./drive.ts"
import { latestStep } from "./fold-steps.ts"
import { canApplySandbox } from "../sandbox.ts"
import { llmPromptText } from "./llm.ts"

const homes: string[] = []
const prevPath = process.env.PATH
afterEach(() => {
  process.env.PATH = prevPath
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

/** A stub for the CLI that records its arguments and stdin, then prints a line. */
function setup(cli: "claude" | "agent", opts: { system?: boolean } = {}) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-llm-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  mkdirSync(join(wf, "nodes", "l"), { recursive: true })
  writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Summarize the input.\n")
  if (opts.system) {
    writeFileSync(join(wf, "nodes", "l", "system.md"), "You are terse.\n")
  }
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, cli),
    [
      "#!/bin/sh",
      'printf "%s" "$*" > "$NODE_OUT/args.txt"',
      'cat > "$NODE_OUT/stdin.txt"',
      'printf "  a summary  \\n\\n"',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return { home, log: new EventLog(appDbPath(home)) }
}

const graph = (cli: "claude" | "cursor", extra: object = {}) =>
  nodeWorkflowSchema.parse({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "l", kind: "llm", cli, ...extra },
      { id: "c", kind: "command", run: "cat $NODE_IN/text.md" },
    ],
    edges: [
      { from: "t", to: "l" },
      { from: "l", to: "c" },
    ],
  })

async function call(cli: "claude" | "cursor", extra: object = {}, system = false) {
  const { home, log } = setup(cli === "claude" ? "claude" : "agent", { system })
  const state = await runNodes({
    log,
    home,
    runId: "r1",
    graph: graph(cli, extra),
    inputText: "a long story",
  })
  const events: EngineEvent[] = log.listByRun("r1").map((s) => s.event)
  log.close()
  const out = join(runDir(workflowDir(home, "wf"), "r1"), "nodes/l/pass-1/attempt-1/out")
  return { home, state, events, out }
}

describe("llm node", () => {
  it("runs Claude in print mode with tools off and feeds stdout on as text", async () => {
    const { state, events, out } = await call("claude", { model: "sonnet" }, true)
    expect(latestStep(state, "l")?.status).toBe("done")
    expect(latestStep(state, "c")?.status).toBe("done")
    expect(events.at(-1)?.type).toBe("run_succeeded")
    const args = readFileSync(join(out, "args.txt"), "utf8")
    expect(args).toContain("--print")
    expect(args).toContain("--no-session-persistence")
    expect(args).toContain("--model sonnet")
    const stdin = readFileSync(join(out, "stdin.txt"), "utf8")
    expect(stdin.startsWith("You are terse.\n\nSummarize the input.\n\n## Input")).toBe(true)
    expect(stdin).toContain("a long story")
  })

  it("stores trimmed stdout as the text of the step", async () => {
    const { home } = await call("claude")
    const step = join(runDir(workflowDir(home, "wf"), "r1"), "nodes/l/pass-1")
    expect(readFileSync(join(step, "text.md"), "utf8")).toBe("a summary")
    const next = join(runDir(workflowDir(home, "wf"), "r1"), "nodes/c/pass-1/text.md")
    expect(readFileSync(next, "utf8")).toContain("a summary")
  })

  it("runs Cursor in ask mode without --force", async () => {
    const { state, out } = await call("cursor")
    expect(latestStep(state, "l")?.status).toBe("done")
    const args = readFileSync(join(out, "args.txt"), "utf8")
    expect(args).toContain("-p")
    expect(args).toContain("--mode ask")
    expect(args).not.toContain("--force")
  })

  it("fails when prompt.md is missing", async () => {
    const { home, log } = setup("claude")
    rmSync(join(workflowDir(home, "wf"), "nodes", "l", "prompt.md"))
    const state = await runNodes({
      log,
      home,
      runId: "r1",
      graph: graph("claude"),
      inputText: "x",
    })
    log.close()
    expect(latestStep(state, "l")?.status).toBe("failed")
  })
})

describe("llm command building", () => {
  const resolved = { modelSource: "cli" as const }
  it("Claude: print, no tools, prompt on stdin", () => {
    const cmd = getCliAdapter("claude").buildLlmCommand("/a b/prompt.txt", resolved)
    expect(cmd).toBe(
      `claude --print --tools "" --permission-mode dontAsk --no-session-persistence < '/a b/prompt.txt'`
    )
  })
  it("Cursor: ask mode, trust, no force", () => {
    const cmd = getCliAdapter("cursor").buildLlmCommand("/p.txt", resolved)
    expect(cmd).toBe("agent -p --mode ask --trust < '/p.txt'")
  })
})

describe("llmPromptText", () => {
  it("puts system, prompt, then input; leaves out what is empty", () => {
    expect(llmPromptText({ system: "S", prompt: "P\n", input: "I\n" })).toBe(
      "S\n\nP\n\n## Input\n\nI\n"
    )
    expect(llmPromptText({ prompt: "P", input: "" })).toBe("P\n")
  })
})

describe("llm sandbox", () => {
  it.skipIf(!canApplySandbox())(
    "writes only the attempt folder, not the rest of the workflow",
    async () => {
      const { home, log } = setup("claude")
      const wf = workflowDir(home, "wf")
      writeFileSync(
        join(home, "bin", "claude"),
        [
          "#!/bin/sh",
          `echo leak > "${wf}/leak.txt" 2>/dev/null`,
          'echo ok > "$NODE_OUT/inside.txt"',
          "echo done",
          "",
        ].join("\n"),
        { mode: 0o755 }
      )
      const state = await runNodes({
        log,
        home,
        runId: "r1",
        graph: graph("claude"),
        inputText: "x",
      })
      log.close()
      expect(latestStep(state, "l")?.status).toBe("done")
      expect(existsSync(join(wf, "leak.txt"))).toBe(false)
      const out = join(runDir(wf, "r1"), "nodes/l/pass-1/attempt-1/out/inside.txt")
      expect(existsSync(out)).toBe(true)
    }
  )
})

// Opt-in: FLOWS_LIVE_LLM=1 calls the installed CLIs for real (a few tokens).
describe.skipIf(process.env.FLOWS_LIVE_LLM !== "1")("llm live", () => {
  it.each(["claude", "cursor"] as const)("%s answers pong", (cli) => {
    const dir = mkdtempSync(join(tmpdir(), "flowapp-llm-live-"))
    homes.push(dir)
    const prompt = join(dir, "prompt.txt")
    writeFileSync(prompt, "Reply with exactly the word pong.\n")
    const cmd = getCliAdapter(cli).buildLlmCommand(prompt, { modelSource: "cli" })
    const out = execFileSync("/bin/sh", ["-c", cmd], { cwd: dir, encoding: "utf8" })
    expect(out.toLowerCase()).toContain("pong")
  }, 90_000)
})
