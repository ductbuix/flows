import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { runNodes } from "./drive.ts"
import { latestStep } from "./fold-steps.ts"

// Judge in check mode (BL-101): a named answer is tested in the tick, with
// no process and no model call.
const homes: string[] = []
const prevPath = process.env.PATH
afterEach(() => {
  process.env.PATH = prevPath
  delete process.env.ANSWER_JSON
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const decls = [
  { name: "risk", type: "choice", labels: ["low", "high"] },
  { name: "score", type: "number" },
  { name: "ready", type: "yesno" },
  { name: "tags", type: "list" },
  { name: "note", type: "text" },
]

const reply = {
  risk: "high",
  score: 7,
  ready: true,
  tags: ["bug", "ui"],
  note: "Needs a review",
}

/** A stub `claude` that prints $ANSWER_JSON; a Judge run would also call it. */
function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-judge-check-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  mkdirSync(join(wf, "nodes", "l"), { recursive: true })
  writeFileSync(join(wf, "nodes", "l", "prompt.md"), "Assess.\n")
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      'if [ "$NODE_ID" = l ]; then',
      "  printf '```json\\n%s\\n```\\n' \"$ANSWER_JSON\"",
      "else",
      "  touch \"$NODE_OUT/model-was-called\"; echo yes",
      "fi",
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return { home, log: new EventLog(appDbPath(home)) }
}

const graph = (check: object) =>
  workflowSchema.parse({
    id: "wf",
    // One CLI slot: the LLM step takes it, the Judge must not need one.
    limits: { agents: 1 },
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "l", kind: "llm", cli: "claude", answers: decls },
      { id: "j", kind: "judge", mode: "check", check },
      { id: "a", kind: "command", run: "cat $NODE_IN/text.md" },
      { id: "b", kind: "command", run: "echo no-branch" },
    ],
    edges: [
      { from: "t", to: "l" },
      { from: "l", to: "j" },
      { from: "j", to: "a", branch: "yes" },
      { from: "j", to: "b", branch: "no" },
    ],
  })

async function check(c: object, answer: object = reply) {
  const { home, log } = setup()
  process.env.ANSWER_JSON = JSON.stringify(answer)
  const state = await runNodes({ log, home, runId: "r1", graph: graph(c), inputText: "x" })
  const events: EngineEvent[] = log.listByRun("r1").map((s) => s.event)
  log.close()
  return { home, state, events }
}

describe("judge node, check mode", () => {
  // One case per operator, each with the branch it takes and one that flips it.
  it.each([
    ["=", { field: "risk", operator: "=", value: "high" }, "yes"],
    ["= (text, ignores case)", { field: "risk", operator: "=", value: "HIGH" }, "yes"],
    ["= (number)", { field: "score", operator: "=", value: 7 }, "yes"],
    ["= (yes or no)", { field: "ready", operator: "=", value: "yes" }, "yes"],
    ["= (differs)", { field: "risk", operator: "=", value: "low" }, "no"],
    ["!=", { field: "risk", operator: "!=", value: "low" }, "yes"],
    ["!= (equal)", { field: "risk", operator: "!=", value: "high" }, "no"],
    [">", { field: "score", operator: ">", value: 6 }, "yes"],
    ["> (equal)", { field: "score", operator: ">", value: 7 }, "no"],
    [">=", { field: "score", operator: ">=", value: 7 }, "yes"],
    [">= (below)", { field: "score", operator: ">=", value: 8 }, "no"],
    ["<", { field: "score", operator: "<", value: 8 }, "yes"],
    ["< (equal)", { field: "score", operator: "<", value: 7 }, "no"],
    ["<=", { field: "score", operator: "<=", value: 7 }, "yes"],
    ["<= (above)", { field: "score", operator: "<=", value: 6 }, "no"],
    ["contains (list)", { field: "tags", operator: "contains", value: "ui" }, "yes"],
    ["contains (list, no match)", { field: "tags", operator: "contains", value: "u" }, "no"],
    ["contains (text)", { field: "note", operator: "contains", value: "review" }, "yes"],
    ["contains (text, no match)", { field: "note", operator: "contains", value: "ship" }, "no"],
    ["set", { field: "note", operator: "set" }, "yes"],
    ["unset", { field: "note", operator: "unset" }, "no"],
  ] as const)("%s takes the %s branch", async (_name, c, branch) => {
    const { home, state, events } = await check(c)
    expect(latestStep(state, "j")).toMatchObject({ status: "done", branch })
    const [taken, other] = branch === "yes" ? ["a", "b"] : ["b", "a"]
    expect(latestStep(state, taken!)?.status).toBe("done")
    expect(latestStep(state, other!)?.status).toBe("skipped")
    expect(events.at(-1)?.type).toBe("run_succeeded")
    // No process and no slot: the Judge never launched an attempt.
    expect(
      events.filter((e) => e.type === "attempt_launched" && e.nodeId === "j")
    ).toEqual([])
    // It forwards what came in on the branch it took.
    const root = runDir(workflowDir(home, "wf"), "r1")
    expect(readFileSync(join(root, "nodes/j/pass-1/text.md"), "utf8")).toContain(
      "risk: high"
    )
  })

  it("treats an empty answer as unset", async () => {
    const empty = { ...reply, note: "  " }
    const set = await check({ field: "note", operator: "set" }, empty)
    expect(latestStep(set.state, "j")).toMatchObject({ branch: "no" })
    const unset = await check({ field: "note", operator: "unset" }, empty)
    expect(latestStep(unset.state, "j")).toMatchObject({ branch: "yes" })
  })

  it("does not call the model", async () => {
    const { home } = await check({ field: "risk", operator: "=", value: "high" })
    const root = runDir(workflowDir(home, "wf"), "r1")
    expect(() => readFileSync(join(root, "nodes/j/pass-1/attempt-1/out/model-was-called"))).toThrow()
  })
})

describe("judge check settings", () => {
  const nodes = (judge: object) => ({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "l", kind: "llm", cli: "claude", answers: decls },
      { id: "j", ...judge },
    ],
    edges: [{ from: "t", to: "l" }, { from: "l", to: "j" }],
  })
  const messages = (judge: object) => {
    const r = workflowSchema.safeParse(nodes(judge))
    return r.success ? [] : r.error.issues.map((i) => i.message)
  }

  it("accepts a check and a rule", () => {
    expect(
      messages({ kind: "judge", mode: "check", check: { field: "risk", operator: "=", value: "high" } })
    ).toEqual([])
    expect(messages({ kind: "judge", cli: "claude" })).toEqual([])
  })

  it("refuses settings that do not fit the mode", () => {
    const m = (j: object) => messages({ kind: "judge", ...j }).join("|")
    expect(m({ mode: "check" })).toContain("check mode needs check")
    expect(m({ mode: "check", cli: "claude", check: { field: "risk", operator: "set" } })).toContain(
      "cli is only for mode: rule"
    )
    expect(m({ cli: "claude", check: { field: "risk", operator: "set" } })).toContain(
      "check is only for mode: check"
    )
    expect(m({})).toContain("judge needs cli")
    expect(m({ mode: "check", check: { field: "risk", operator: "set", value: 1 } })).toContain(
      "set takes no value"
    )
    expect(m({ mode: "check", check: { field: "risk", operator: "=" } })).toContain("needs a value")
    expect(m({ mode: "check", check: { field: "score", operator: ">", value: "big" } })).toContain(
      "needs a number"
    )
    expect(m({ mode: "check", check: { field: "risk", operator: "~", value: 1 } })).not.toEqual([])
    expect(m({ mode: "check", check: { field: "nope", operator: "set" } })).toContain(
      "no upstream node declares it"
    )
  })
})
