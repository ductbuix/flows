import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema, type EngineEvent } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { judgeNodeKey, judgeVerdict } from "../judge.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { runNodes } from "./drive.ts"
import { foldSteps, latestStep } from "./fold-steps.ts"

const homes: string[] = []
const prevPath = process.env.PATH
afterEach(() => {
  process.env.PATH = prevPath
  delete process.env.JUDGE_ANSWER
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

/** Stub `claude` that prints $JUDGE_ANSWER and keeps the prompt it got. */
function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-judge-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  mkdirSync(join(wf, "nodes", "j"), { recursive: true })
  writeFileSync(join(wf, "nodes", "j", "rule.md"), "Is the story short?\n")
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      'printf "%s" "$*" > "$NODE_OUT/args.txt"',
      'cp input/rule.md "$NODE_OUT/rule.md"',
      'printf "%s\\n" "$JUDGE_ANSWER"',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return { home, log: new EventLog(appDbPath(home)) }
}

const graph = () =>
  workflowSchema.parse({
    id: "wf",
    nodes: [
      { id: "t", kind: "trigger", type: "manual" },
      { id: "j", kind: "judge", cli: "claude" },
      { id: "a", kind: "command", run: "cat $NODE_IN/text.md" },
      { id: "b", kind: "command", run: "echo no-branch" },
    ],
    edges: [
      { from: "t", to: "j" },
      { from: "j", to: "a", branch: "yes" },
      { from: "j", to: "b", branch: "no" },
    ],
  })

async function ask(answer: string) {
  const { home, log } = setup()
  process.env.JUDGE_ANSWER = answer
  const state = await runNodes({
    log,
    home,
    runId: "r1",
    graph: graph(),
    inputText: "a short story",
  })
  const events: EngineEvent[] = log.listByRun("r1").map((s) => s.event)
  log.close()
  return { home, state, events }
}

describe("judge node, rule mode", () => {
  it.each([
    ["yes", "yes"],
    ["Yes, it is short.", "yes"],
    ["true", "yes"],
    ["no", "no"],
    ["**No**: too long", "no"],
    ["false", "no"],
  ] as const)("%s takes the %s branch and skips the other", async (answer, branch) => {
    const { home, state, events } = await ask(answer)
    expect(latestStep(state, "j")).toMatchObject({ status: "done", branch })
    const taken = branch === "yes" ? "a" : "b"
    const other = branch === "yes" ? "b" : "a"
    expect(latestStep(state, taken)?.status).toBe("done")
    expect(latestStep(state, other)?.status).toBe("skipped")
    expect(events.at(-1)?.type).toBe("run_succeeded")
    const root = runDir(workflowDir(home, "wf"), "r1")
    // The branch forwards what came in.
    expect(readFileSync(join(root, "nodes/j/pass-1/text.md"), "utf8")).toContain(
      "a short story"
    )
    // The rule is copied into the attempt, and the prompt names it.
    const out = join(root, "nodes/j/pass-1/attempt-1/out")
    expect(readFileSync(join(out, "rule.md"), "utf8")).toBe("Is the story short?\n")
    expect(readFileSync(join(out, "args.txt"), "utf8")).toContain("input/rule.md")
  })

  it("fails with reason unclear when the first word is not yes or no", async () => {
    const { state, events } = await ask("Maybe, it depends.")
    expect(latestStep(state, "j")).toMatchObject({
      status: "failed",
      failReason: "unclear",
    })
    expect(events.find((e) => e.type === "step_failed")).toMatchObject({
      nodeId: "j",
      reason: "unclear",
    })
    expect(events.at(-1)?.type).toBe("run_failed")
    expect(latestStep(foldSteps(events), "a")?.status).toBe("skipped")
  })
})

describe("judgeVerdict", () => {
  it("reads the first word only", () => {
    expect(judgeVerdict("yes")).toBe("yes")
    expect(judgeVerdict("  TRUE\n")).toBe("yes")
    expect(judgeVerdict("No.")).toBe("no")
    expect(judgeVerdict("false because")).toBe("no")
    expect(judgeVerdict("I think yes")).toBeUndefined()
    expect(judgeVerdict("yesterday")).toBeUndefined()
    expect(judgeVerdict("")).toBeUndefined()
  })
})

describe("judgeNodeKey", () => {
  const base = {
    judge: { cli: "claude" as const },
    resolved: { modelSource: "cli" as const },
    nodeId: "j",
    pass: 1,
    rule: "r",
    inputHash: "h",
  }
  it("changes with the pass and the input hash", () => {
    const k = judgeNodeKey(base)
    expect(judgeNodeKey(base)).toBe(k)
    expect(judgeNodeKey({ ...base, pass: 2 })).not.toBe(k)
    expect(judgeNodeKey({ ...base, inputHash: "h2" })).not.toBe(k)
    expect(judgeNodeKey({ ...base, rule: "r2" })).not.toBe(k)
  })
})
