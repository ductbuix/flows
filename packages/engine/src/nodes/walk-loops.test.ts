import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  findLoopEdges,
  loopWarnings,
  nodeWorkflowSchema,
  type EngineEvent,
} from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, workflowDir } from "../paths.ts"
import { runNodes } from "./drive.ts"
import { foldSteps, type StepsState } from "./fold-steps.ts"

const homes: string[] = []
const prevPath = process.env.PATH
afterEach(() => {
  process.env.PATH = prevPath
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

type Edge = { from: string; to: string; branch?: string }

/**
 * Stub `claude` for Judge nodes. The first line of `rule.md` names the
 * Judge; it answers "no" for the first N asks (file `nos-<name>`), then "yes".
 */
function setup(judges: Record<string, number>) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-loops-"))
  homes.push(home)
  const wf = workflowDir(home, "wf")
  const counts = join(wf, "counts") // the sandbox writes under the workflow
  mkdirSync(counts, { recursive: true })
  for (const [name, nos] of Object.entries(judges)) {
    mkdirSync(join(wf, "nodes", name), { recursive: true })
    writeFileSync(join(wf, "nodes", name, "rule.md"), `${name}\nIs it good?\n`)
    writeFileSync(join(counts, `nos-${name}`), String(nos))
  }
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(
    join(bin, "claude"),
    [
      "#!/bin/sh",
      `C=${counts}`,
      "name=$(head -1 input/rule.md | tr -d ' \\n')",
      'n=$(cat "$C/asked-$name" 2>/dev/null || echo 0)',
      'echo $((n + 1)) > "$C/asked-$name"',
      'nos=$(cat "$C/nos-$name")',
      'if [ "$n" -lt "$nos" ]; then echo no; else echo yes; fi',
      "",
    ].join("\n"),
    { mode: 0o755 }
  )
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return { home, log: new EventLog(appDbPath(home)) }
}

async function run(
  judges: Record<string, number>,
  nodes: { id: string; kind: string; [k: string]: unknown }[],
  edges: Edge[],
  limits?: { loopPasses: number }
) {
  const { home, log } = setup(judges)
  const graph = nodeWorkflowSchema.parse({
    id: "wf",
    ...(limits ? { limits } : {}),
    nodes: [{ id: "t", kind: "trigger", type: "manual" }, ...nodes],
    edges,
  })
  const state = await runNodes({ log, home, runId: "r1", graph, inputText: "hi" })
  const events: EngineEvent[] = log.listByRun("r1").map((s) => s.event)
  log.close()
  return { home, state, events }
}

const passes = (state: StepsState, id: string) =>
  (state.steps[id] ?? []).map((s) => `${s.pass}:${s.status}`)
const cmd = (id: string) => ({ id, kind: "command", run: "echo round" })
const judge = (id: string) => ({ id, kind: "judge", cli: "claude" })

describe("loops", () => {
  it("a Judge loop runs again on No and ends on Yes", async () => {
    const { state, events } = await run(
      { j: 2 },
      [cmd("a"), judge("j"), cmd("ok")],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    expect(passes(state, "a")).toEqual(["1:done", "2:done", "3:done"])
    expect(passes(state, "j")).toEqual(["1:done", "2:done", "3:done"])
    expect(state.steps.j!.map((s) => s.branch)).toEqual(["no", "no", "yes"])
    // `ok` was skipped while the Judge said No, then ran once.
    expect(passes(state, "ok")).toEqual(["1:done"])
    expect(events.at(-1)?.type).toBe("run_succeeded")
  })

  it("the Judge asks again in each round and never reuses a verdict", async () => {
    const { home } = await run(
      { j: 1 },
      [cmd("a"), judge("j"), cmd("ok")],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    expect(readFileSync(join(workflowDir(home, "wf"), "counts", "asked-j"), "utf8").trim()).toBe("2")
  })

  it("stops with loop_limit when the Judge never says Yes", async () => {
    const { state, events } = await run(
      { j: 99 },
      [cmd("a"), judge("j"), cmd("ok")],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ],
      { loopPasses: 2 }
    )
    expect(passes(state, "a")).toEqual(["1:done", "2:done", "3:failed"])
    expect(state.steps.a![2]!.failReason).toBe("loop_limit")
    expect(passes(state, "j")).toEqual(["1:done", "2:done"])
    expect(events.find((e) => e.type === "step_failed")).toMatchObject({
      nodeId: "a",
      pass: 3,
      reason: "loop_limit",
    })
    expect(events.at(-1)?.type).toBe("run_failed")
  })

  it("nested loops: the inner loop runs again in each outer round", async () => {
    const { state, events } = await run(
      { inner: 1, outer: 1 },
      [cmd("a"), cmd("b"), judge("inner"), judge("outer"), cmd("end")],
      [
        { from: "t", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "inner" },
        { from: "inner", to: "b", branch: "no" },
        { from: "inner", to: "outer", branch: "yes" },
        { from: "outer", to: "a", branch: "no" },
        { from: "outer", to: "end", branch: "yes" },
      ]
    )
    expect(state.steps.a).toHaveLength(2)
    expect(state.steps.b).toHaveLength(3)
    expect(state.steps.inner!.map((s) => s.branch)).toEqual(["no", "yes", "yes"])
    expect(state.steps.outer!.map((s) => s.branch)).toEqual(["no", "yes"])
    expect(passes(state, "end")).toEqual(["1:done"])
    expect(events.at(-1)?.type).toBe("run_succeeded")
  })

  it("a self loop on a Judge asks again until Yes", async () => {
    const { state, events } = await run(
      { j: 2 },
      [judge("j"), cmd("ok")],
      [
        { from: "t", to: "j" },
        { from: "j", to: "j", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    expect(state.steps.j!.map((s) => s.branch)).toEqual(["no", "no", "yes"])
    expect(passes(state, "ok")).toEqual(["1:done"])
    expect(events.at(-1)?.type).toBe("run_succeeded")
  })

  it("a self loop with no Judge runs to the default limit of five", async () => {
    const { state } = await run(
      {},
      [cmd("s")],
      [
        { from: "t", to: "s" },
        { from: "s", to: "s" },
      ]
    )
    expect(passes(state, "s")).toEqual([
      "1:done",
      "2:done",
      "3:done",
      "4:done",
      "5:done",
      "6:failed",
    ])
    expect(state.steps.s![5]!.failReason).toBe("loop_limit")
  })

  it("a resumed fold sees the same passes", async () => {
    const { events } = await run(
      { j: 1 },
      [cmd("a"), judge("j"), cmd("ok")],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    expect(foldSteps(events).steps.a).toHaveLength(2)
  })
})

describe("findLoopEdges", () => {
  const nodes = ["t", "a", "b", "c"].map((id) => ({ id, kind: "command" }))
  const e = (from: string, to: string) => ({ from, to })

  it("marks self edges and the edges into each cycle's entry", () => {
    const edges = [e("t", "a"), e("a", "b"), e("b", "c"), e("c", "b"), e("c", "a"), e("c", "c")]
    expect([...findLoopEdges(nodes, edges)].sort()).toEqual([3, 4, 5])
  })

  it("breaks ties by node order, not edge order", () => {
    // a and b form a cycle that t enters at both; a comes first in the file.
    const edges = [e("t", "b"), e("t", "a"), e("b", "a"), e("a", "b")]
    expect([...findLoopEdges(nodes, edges)]).toEqual([2])
    const swapped = [{ id: "t", kind: "command" }, { id: "b", kind: "command" }, { id: "a", kind: "command" }]
    expect([...findLoopEdges(swapped, edges)]).toEqual([3])
  })

  it("has none in a forward graph", () => {
    expect(findLoopEdges(nodes, [e("t", "a"), e("a", "b"), e("t", "b")]).size).toBe(0)
  })
})

describe("loopWarnings", () => {
  const e = (from: string, to: string, branch?: string) => ({
    from,
    to,
    ...(branch ? { branch } : {}),
  })
  it("warns on a cycle with no Judge, not on one with a Judge", () => {
    const plain = [
      { id: "t", kind: "trigger" },
      { id: "a", kind: "agent" },
      { id: "b", kind: "agent" },
    ]
    const warns = loopWarnings(plain, [e("t", "a"), e("a", "b"), e("b", "a")])
    expect(warns).toHaveLength(1)
    expect(warns[0]!.message).toMatch(/no Judge/)
    const withJudge = [plain[0]!, plain[1]!, { id: "j", kind: "judge" }]
    expect(
      loopWarnings(withJudge, [e("t", "a"), e("a", "j"), e("j", "a", "no")])
    ).toEqual([])
  })
})
