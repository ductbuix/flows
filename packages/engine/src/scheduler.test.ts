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
import { createEngine } from "./engine.ts"
import { foldEvents } from "./fold.ts"

const diamondYaml = `
id: diamond
goal: a then b and c in parallel then d
tasks:
  - id: a
    kind: command
    run: "printf a > \\"$TASK_OUT/letter.txt\\""
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: c
    kind: command
    run: "printf c > \\"$TASK_OUT/letter.txt\\""
    needs: [a]
  - id: d
    kind: command
    run: "printf '%s%s%s' \\"$(cat \\"$UPSTREAM_a/letter.txt\\")\\" \\"$(cat \\"$UPSTREAM_b/letter.txt\\")\\" \\"$(cat \\"$UPSTREAM_c/letter.txt\\")\\" > \\"$TASK_OUT/out.txt\\""
    needs: [b, c]
`

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-"))
  homes.push(home)
  return home
}

function writeDiamond(home: string): string {
  const workflowDir = join(home, "workflows", "diamond")
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), diamondYaml)
  return workflowDir
}

describe("scheduler diamond graph", () => {
  it("runs a, then b and c in parallel, then d to success", async () => {
    const home = tempHome()
    const workflowDir = writeDiamond(home)
    const engine = createEngine({ home })

    const handle = await engine.startRun({ workflowDir, runId: "run-1" })
    const state = await handle.wait()

    expect(state.status).toBe("succeeded")
    expect(state.tasks.a?.status).toBe("succeeded")
    expect(state.tasks.b?.status).toBe("succeeded")
    expect(state.tasks.c?.status).toBe("succeeded")
    expect(state.tasks.d?.status).toBe("succeeded")

    const out = readFileSync(
      join(
        workflowDir,
        "runs",
        "run-1",
        "tasks",
        "d",
        "latest",
        "out",
        "out.txt"
      ),
      "utf8"
    )
    expect(out).toBe("abc")

    // b and c should have overlapped: both launched before either finished.
    const events = engine.events("run-1")
    const bLaunch = events.findIndex(
      (e) => e.type === "attempt_launched" && e.taskId === "b"
    )
    const cLaunch = events.findIndex(
      (e) => e.type === "attempt_launched" && e.taskId === "c"
    )
    const bDone = events.findIndex(
      (e) => e.type === "attempt_finished" && e.taskId === "b"
    )
    const cDone = events.findIndex(
      (e) => e.type === "attempt_finished" && e.taskId === "c"
    )
    expect(bLaunch).toBeGreaterThan(-1)
    expect(cLaunch).toBeGreaterThan(-1)
    expect(Math.max(bLaunch, cLaunch)).toBeLessThan(Math.min(bDone, cDone))

    engine.close()
  }, 20_000)

  it("replaying the event log yields the same state as the live run", async () => {
    const home = tempHome()
    const workflowDir = writeDiamond(home)
    const engine = createEngine({ home })

    const handle = await engine.startRun({ workflowDir, runId: "run-2" })
    const live = await handle.wait()
    const replayed = foldEvents(engine.events("run-2"))

    expect(replayed).toEqual(live)
    engine.close()
  }, 20_000)
})
