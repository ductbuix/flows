import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createEngine } from "./engine.ts"

const homes: string[] = []

beforeEach(() => {
  process.env.FLOWAPP_RETRY_BACKOFF_MS = "50"
})

afterEach(() => {
  delete process.env.FLOWAPP_RETRY_BACKOFF_MS
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-loop-"))
  homes.push(home)
  return home
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

describe("when and skip propagation", () => {
  it("skips a task when when is false and propagates skip", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "when-false",
      `
id: when-false
tasks:
  - id: a
    kind: command
    run: "printf a > \\"$TASK_OUT/a.txt\\""
    when: false
  - id: b
    kind: command
    run: "printf b > \\"$TASK_OUT/b.txt\\""
    needs: [a]
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.a?.status).toBe("skipped")
    expect(state.tasks.a?.skipReason).toBe("when")
    expect(state.tasks.b?.status).toBe("skipped")
    expect(state.tasks.b?.skipReason).toBe("upstream_skip")
    engine.close()
  })

  it("runs a branch edge when exit matches and skips the other", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "branch",
      `
id: branch
tasks:
  - id: check
    kind: command
    run: "exit 0"
  - id: ok
    kind: command
    run: "printf ok > \\"$TASK_OUT/x.txt\\""
    needs:
      - task: check
        when: { exit: 0 }
  - id: bad
    kind: command
    run: "printf bad > \\"$TASK_OUT/x.txt\\""
    needs:
      - task: check
        when: { exit: 1 }
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.check?.status).toBe("succeeded")
    expect(state.tasks.ok?.status).toBe("succeeded")
    expect(state.tasks.bad?.status).toBe("skipped")
    expect(state.tasks.bad?.skipReason).toBe("branch")
    engine.close()
  })

  it("honours when exit against upstream", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "when-exit",
      `
id: when-exit
tasks:
  - id: check
    kind: command
    run: "exit 0"
  - id: publish
    kind: command
    run: "printf pub > \\"$TASK_OUT/p.txt\\""
    needs: [check]
    when: { exit: 0 }
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.publish?.status).toBe("succeeded")
    engine.close()
  })
})

describe("retry and repeat", () => {
  it("retries a failing command until success", async () => {
    const home = tempHome()
    const workflowDir = join(home, "workflows", "retry")
    mkdirSync(workflowDir, { recursive: true })
    const counter = join(workflowDir, "count.txt")
    writeFileSync(counter, "0")
    const script = join(workflowDir, "flaky.sh")
    writeFileSync(
      script,
      `#!/bin/sh
n=$(cat '${counter}')
n=$((n+1))
printf '%s' "$n" > '${counter}'
if [ "$n" -lt 2 ]; then exit 1; fi
printf ok > "$TASK_OUT/out.txt"
`,
      { mode: 0o755 }
    )
    writeWorkflow(
      home,
      "retry",
      `
id: retry
tasks:
  - id: flaky
    kind: command
    run: "sh '${script}'"
    retry: { max: 3 }
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.flaky?.status).toBe("succeeded")
    expect(state.tasks.flaky?.attempts.length).toBe(2)
    expect(readFileSync(counter, "utf8")).toBe("2")
    engine.close()
  })

  it("repeats until expr passes with separate attempt dirs", async () => {
    const home = tempHome()
    const workflowDir = join(home, "workflows", "repeat")
    mkdirSync(workflowDir, { recursive: true })
    const counter = join(workflowDir, "rep.txt")
    writeFileSync(counter, "0")
    const script = join(workflowDir, "score.sh")
    writeFileSync(
      script,
      `#!/bin/sh
n=$(cat '${counter}')
n=$((n+1))
printf '%s' "$n" > '${counter}'
printf '{"score":0.%s}' "$n" > "$TASK_OUT/score.json"
`,
      { mode: 0o755 }
    )
    writeWorkflow(
      home,
      "repeat",
      `
id: repeat
tasks:
  - id: score
    kind: command
    run: "sh '${script}'"
    repeat:
      max: 5
      until: { expr: "json('out/score.json').score >= 0.3" }
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.score?.status).toBe("succeeded")
    expect(state.tasks.score?.attempts.length).toBe(3)
    const third = join(
      workflowDir,
      "runs",
      "r1",
      "tasks",
      "score",
      "attempt-3",
      "out",
      "score.json"
    )
    expect(JSON.parse(readFileSync(third, "utf8")).score).toBe(0.3)
    engine.close()
  })

  it("fails when retry max is exhausted", async () => {
    const home = tempHome()
    const workflowDir = writeWorkflow(
      home,
      "retry-fail",
      `
id: retry-fail
tasks:
  - id: always
    kind: command
    run: "exit 7"
    retry: { max: 2 }
`
    )
    const engine = createEngine({ home })
    const state = await (await engine.startRun({ workflowDir, runId: "r1" })).wait()
    expect(state.status).toBe("failed")
    expect(state.tasks.always?.status).toBe("failed")
    expect(state.tasks.always?.attempts.length).toBe(2)
    engine.close()
  })
})
