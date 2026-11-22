import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { NODE_KINDS, nodeWorkflowSchema } from "@workspace/shared"
import { EventLog } from "../event-log.ts"
import { appDbPath, runDir, workflowDir } from "../paths.ts"
import { EXECUTORS } from "./registry.ts"
import { CrashError, startNodeRun, tickNodes } from "./tick.ts"

const homes: string[] = []
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

const graph = nodeWorkflowSchema.parse({
  id: "wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "p", kind: "prompt" },
    { id: "o", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "t", to: "o" },
    { from: "p", to: "o" },
  ],
})

function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-tick-"))
  homes.push(home)
  const nodeDir = join(workflowDir(home, "wf"), "nodes", "p")
  mkdirSync(nodeDir, { recursive: true })
  writeFileSync(join(nodeDir, "text.md"), "house rules")
  const log = new EventLog(appDbPath(home))
  return { home, log }
}

function tree(root: string, dir = root, out: Record<string, string> = {}) {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) tree(root, abs, out)
    else out[abs.slice(root.length + 1)] = readFileSync(abs, "utf8")
  }
  return out
}

const types = (log: EventLog, runId: string) =>
  log.listByRun(runId).map((s) => s.event.type)

describe("registry", () => {
  it("has an executor for every no-process kind and no unknown kind", () => {
    const shared = new Set(NODE_KINDS.map((k) => k.kind))
    for (const e of EXECUTORS) expect(shared.has(e.kind as never)).toBe(true)
    const have = new Set(EXECUTORS.map((e) => e.kind))
    for (const k of NODE_KINDS) {
      if (k.process === "none") expect(have.has(k.kind)).toBe(true)
    }
    expect(have.size).toBe(EXECUTORS.length)
  })

  it("matches shared kinds, executors and web views (DES-035)", () => {
    const dir = fileURLToPath(
      new URL("../../../../apps/web/src/nodes/", import.meta.url)
    )
    // One `<kind>.tsx` per kind; capitalised files are shared parts.
    const views = readdirSync(dir)
      .filter((f) => /^[a-z]+\.tsx$/.test(f))
      .map((f) => f.replace(".tsx", ""))
      .sort()
    const kinds = NODE_KINDS.map((k) => k.kind).sort()
    expect(views).toEqual(kinds)
    expect(EXECUTORS.map((e) => e.kind).sort()).toEqual(kinds)
  })
})

describe("tickNodes", () => {
  it("runs trigger, prompt and output end to end", () => {
    const { home, log } = setup()
    const state = startNodeRun({
      log,
      home,
      runId: "r1",
      graph,
      inputText: "story text",
    })
    expect(state.ended).toBe(true)
    const t = types(log, "r1")
    expect(t[0]).toBe("run_started")
    expect(t.at(-1)).toBe("run_succeeded")
    // step_started precedes every step_done
    expect(t.filter((x) => x === "step_started")).toHaveLength(3)
    const files = tree(runDir(workflowDir(home, "wf"), "r1"))
    expect(files["nodes/t/pass-1/text.md"]).toBe("story text")
    expect(files["nodes/p/pass-1/text.md"]).toBe("house rules")
    expect(files["output/t/text.md"]).toBe("story text")
    expect(files["output/p/text.md"]).toBe("house rules")
    log.close()
  })

  for (const crashNode of ["t", "p", "o"]) {
    for (const point of ["after_step_started", "after_act"] as const) {
      it(`resumes after a crash at ${point} of ${crashNode}`, () => {
        const clean = setup()
        startNodeRun({ ...clean, runId: "r", graph, inputText: "x" })
        const want = tree(runDir(workflowDir(clean.home, "wf"), "r"))
        clean.log.close()

        const { home, log } = setup()
        let armed = true
        const crashAt = (p: string, id: string) => {
          if (armed && p === point && id === crashNode) {
            armed = false
            throw new CrashError("crash")
          }
        }
        expect(() =>
          startNodeRun({ log, home, runId: "r", graph, inputText: "x", crashAt })
        ).toThrow(CrashError)
        expect(types(log, "r")).not.toContain("run_succeeded")
        const state = tickNodes({ log, home, runId: "r" })
        expect(state.ended).toBe(true)
        expect(types(log, "r").at(-1)).toBe("run_succeeded")
        expect(tree(runDir(workflowDir(home, "wf"), "r"))).toEqual(want)
        log.close()
      })
    }
  }
})
