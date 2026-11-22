import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { assertNodeTemplatesValid } from "./answers.ts"
import { approveNodeStep } from "./cancel.ts"
import { runNodes } from "./drive.ts"
import { latestStep } from "./fold-steps.ts"
import type { ProcessHost } from "./process.ts"

const homes: string[] = []
const prevPath = process.env.PATH
afterEach(() => {
  process.env.PATH = prevPath
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const answers = [
  { name: "risk", type: "choice", labels: ["low", "high"] },
  { name: "score", type: "number" },
]

/**
 * A stub `claude`. LLM node `l` replies with `bad` until its prompt holds the
 * fix request (unless `stubborn`), then with the good answer. Agent node `a`
 * copies its instructions and writes `out/answer.json`.
 */
function setup(opts: { stubborn?: boolean } = {}) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-answers-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  for (const id of ["l", "a", "j", "p"]) mkdirSync(join(wf, "nodes", id), { recursive: true })
  writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Assess the input.\n")
  writeFileSync(join(wf, "nodes", "a", "prompt.md"), "Risk was {{risk}} ({{score}}).\n")
  writeFileSync(join(wf, "nodes", "j", "rule.md"), "Is {{risk}} acceptable?\n")
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const fixed = opts.stubborn ? "false" : "grep -q 'Fix the answer' $NODE_IN/prompt.txt"
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      'if [ "$NODE_ID" = l ]; then',
      '  echo "$*" > "$NODE_OUT/args.txt"',
      `  if ${fixed}; then`,
      '    echo "Fixed:"; echo \'```json\'; echo \'{"risk":"high","score":7}\'; echo \'```\'',
      "  else",
      '    echo \'{"risk":"mid"}\'',
      "  fi",
      'elif [ "$NODE_ID" = a ]; then',
      '  cp "$NODE_INSTRUCTIONS" "$NODE_OUT/instr.txt"',
      '  echo \'{"risk":"low","score":1}\' > "$NODE_OUT/answer.json"',
      "else",
      '  echo yes',
      "fi",
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return { home, wf, log: new EventLog(appDbPath(home)) }
}

const graph = workflowSchema.parse({
  id: "wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "l", kind: "llm", cli: "claude", answers },
    { id: "a", kind: "agent", cli: "claude", answers: [{ name: "note", type: "text" }] },
    { id: "j", kind: "judge", cli: "claude" },
    { id: "p", kind: "approval", question: "Risk {{risk}}, score {{score}}?" },
  ],
  edges: [
    { from: "t", to: "l" },
    { from: "l", to: "a" },
    { from: "a", to: "j" },
    { from: "j", to: "p", branch: "yes" },
  ],
})

async function go(opts: { stubborn?: boolean } = {}) {
  const { home, wf, log } = setup(opts)
  const state = await runNodes({ log, home, runId: "r1", graph, inputText: "x" })
  const events: EngineEvent[] = log.listByRun("r1").map((s) => s.event)
  log.close()
  return { home, wf, state, events, run: runDir(wf, "r1") }
}

describe("named answers", () => {
  it("asks an LLM step once to fix a mismatched answer, then takes it", async () => {
    const { state, events, run } = await go()
    const l = latestStep(state, "l")
    expect(l?.status).toBe("done")
    expect(l?.attempts).toBe(2)
    expect(l?.answer).toEqual({ risk: "high", score: 7 })
    const step = join(run, "nodes/l/pass-1")
    expect(readFileSync(join(step, "text.md"), "utf8")).toBe("risk: high\nscore: 7\n")
    expect(readFileSync(join(step, "attempt-1/answer-error.txt"), "utf8")).toContain(
      "score: missing"
    )
    const prompt = readFileSync(join(step, "attempt-2/input/prompt.txt"), "utf8")
    expect(prompt).toContain('{"risk":"mid"}')
    expect(prompt).toContain("risk: must be one of low, high")
    expect(events.filter((e) => e.type === "attempt_started" && e.nodeId === "l")).toHaveLength(2)
  })

  it("fails with reason answer when the fix is wrong too", async () => {
    const { state, events } = await go({ stubborn: true })
    const l = latestStep(state, "l")
    expect(l?.status).toBe("failed")
    expect(l?.failReason).toBe("answer")
    expect(l?.attempts).toBe(2)
    expect(events.at(-1)?.type).toBe("run_failed")
    expect(latestStep(state, "a")?.status).toBe("skipped")
  })

  it("lists the fields in the LLM prompt and fills {{name}} downstream", async () => {
    const { state, run } = await go()
    const prompt = readFileSync(join(run, "nodes/l/pass-1/attempt-2/input/prompt.txt"), "utf8")
    expect(prompt).toContain('- risk: one of "low", "high"')
    expect(prompt).toContain("- score: a number")
    // The agent got the filled task and asked for out/answer.json.
    const instr = readFileSync(join(run, "nodes/a/pass-1/attempt-1/out/instr.txt"), "utf8")
    expect(instr).toContain("Risk was high (7).")
    expect(instr).toContain("`out/answer.json`")
    expect(instr).toContain("- note: a string")
    // The agent's answer does not match its declaration (note missing), so it is fixed once, then fails.
    expect(latestStep(state, "a")?.failReason).toBe("answer")
  })
})

describe("answers end to end through Agent, Judge and Approval", () => {
  it("fills the rule and the question", async () => {
    const { home, wf, log } = setup()
    // Declare an answer the stub agent really writes.
    const g = workflowSchema.parse({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "a"
          ? {
              id: "a",
              kind: "agent",
              cli: "claude",
              answers: [{ name: "risk2", type: "text" }],
            }
          : n
      ),
    })
    // Write the agent stub to match its declared answer.
    writeFileSync(
      join(home, "bin", "claude"),
      [
        "#!/bin/sh",
        'if [ "$NODE_ID" = l ]; then',
        '  echo \'{"risk":"high","score":7}\'',
        'elif [ "$NODE_ID" = a ]; then',
        '  echo \'{"risk2":"ok"}\' > "$NODE_OUT/answer.json"',
        "else",
        '  cp "$NODE_IN/rule.md" "$NODE_OUT/rule.txt"; echo yes',
        "fi",
        "",
      ].join("\n"),
      { mode: 0o755 }
    )
    // Approve the question as soon as it is asked.
    const poll = setInterval(() => {
      const asked = log.listByRun("r1").some((x) => x.event.type === "approval_requested")
      const decided = log.listByRun("r1").some((x) => x.event.type === "step_approved")
      if (asked && !decided) {
        approveNodeStep(log, "r1", "p")
        host?.wake()
      }
    }, 20)
    let host: ProcessHost | undefined
    const state = await runNodes(
      { log, home, runId: "r1", graph: g, inputText: "x" },
      (h) => {
        host = h
      }
    )
    clearInterval(poll)
    const events = log.listByRun("r1").map((s) => s.event)
    log.close()
    expect(latestStep(state, "a")?.answer).toEqual({ risk2: "ok" })
    expect(latestStep(state, "j")?.status).toBe("done")
    const run = runDir(wf, "r1")
    expect(readFileSync(join(run, "nodes/j/pass-1/attempt-1/out/rule.txt"), "utf8")).toBe(
      "Is high acceptable?\n"
    )
    const asked = events.find((e) => e.type === "approval_requested")
    expect(asked && "question" in asked ? asked.question : "").toBe("Risk high, score 7?")
  })
})

describe("template check at start", () => {
  it("rejects a name two upstream nodes declare in a prompt file", () => {
    const { home, wf, log } = setup()
    log.close()
    const g = workflowSchema.parse({
      id: "wf",
      nodes: [
        { id: "t", kind: "trigger", type: "manual" },
        { id: "l", kind: "llm", cli: "claude", answers },
        { id: "a", kind: "agent", cli: "claude", answers: [{ name: "risk", type: "text" }] },
        { id: "j", kind: "judge", cli: "claude" },
      ],
      edges: [
        { from: "t", to: "l" },
        { from: "t", to: "a" },
        { from: "l", to: "j" },
        { from: "a", to: "j" },
      ],
    })
    expect(() => assertNodeTemplatesValid(home, g)).toThrow(
      "node j rule.md: {{risk}} is ambiguous: l and a both declare it"
    )
    writeFileSync(join(wf, "nodes", "j", "rule.md"), "No names.\n")
    expect(() => assertNodeTemplatesValid(home, g)).not.toThrow()
  })
})
