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
const prevPath = process.env.PATH

beforeEach(() => {
  process.env.FLOWAPP_RETRY_BACKOFF_MS = "20"
})

afterEach(() => {
  process.env.PATH = prevPath
  delete process.env.FLOWAPP_RETRY_BACKOFF_MS
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-judge-"))
  homes.push(home)
  return home
}

function installJudgeStub(
  home: string,
  opts: { name: "claude" | "agent"; exitCode: number; marker?: string }
): void {
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const marker = opts.marker
    ? `printf 'ran' >> "${opts.marker}"\n`
    : ""
  writeFileSync(
    join(bin, opts.name),
    `#!/bin/sh\n${marker}exit ${opts.exitCode}\n`,
    { mode: 0o755 }
  )
  const other = opts.name === "claude" ? "agent" : "claude"
  writeFileSync(join(bin, other), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
}

function writeWorkflow(home: string, id: string, yaml: string): string {
  const workflowDir = join(home, "workflows", id)
  mkdirSync(join(workflowDir, "tasks"), { recursive: true })
  writeFileSync(join(workflowDir, "workflow.yaml"), yaml)
  return workflowDir
}

describe("agent judge conditions", () => {
  it("runs a downstream task when the judge passes", async () => {
    const home = tempHome()
    installJudgeStub(home, { name: "claude", exitCode: 0 })
    const wf = writeWorkflow(
      home,
      "judge-pass",
      `
id: judge-pass
tasks:
  - id: produce
    kind: command
    run: "printf ok > \\"$TASK_OUT/ok.txt\\""
  - id: next
    kind: command
    run: "printf next > \\"$TASK_OUT/n.txt\\""
    needs: [produce]
    when:
      agent:
        cli: claude
        instructions: tasks/judge.md
`
    )
    writeFileSync(join(wf, "tasks", "judge.md"), "Pass if out/ok.txt exists.\n")
    const engine = createEngine({ home })
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.produce?.status).toBe("succeeded")
    expect(state.tasks.next?.status).toBe("succeeded")
    engine.close()
  })

  it("skips when the judge fails", async () => {
    const home = tempHome()
    installJudgeStub(home, { name: "claude", exitCode: 1 })
    const wf = writeWorkflow(
      home,
      "judge-fail",
      `
id: judge-fail
tasks:
  - id: produce
    kind: command
    run: "printf ok > \\"$TASK_OUT/ok.txt\\""
  - id: next
    kind: command
    run: "printf next > \\"$TASK_OUT/n.txt\\""
    needs: [produce]
    when:
      agent:
        cli: claude
        instructions: tasks/judge.md
`
    )
    writeFileSync(join(wf, "tasks", "judge.md"), "Always fail.\n")
    const engine = createEngine({ home })
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.produce?.status).toBe("succeeded")
    expect(state.tasks.next?.status).toBe("skipped")
    expect(state.tasks.next?.skipReason).toBe("when")
    engine.close()
  })

  it("uses agent judges on branch edges", async () => {
    const home = tempHome()
    installJudgeStub(home, { name: "agent", exitCode: 0 })
    const wf = writeWorkflow(
      home,
      "judge-branch",
      `
id: judge-branch
tasks:
  - id: check
    kind: command
    run: "printf x > \\"$TASK_OUT/x.txt\\""
  - id: ok
    kind: command
    run: "printf ok > \\"$TASK_OUT/o.txt\\""
    needs:
      - task: check
        when:
          agent:
            cli: cursor
            instructions: tasks/judge.md
`
    )
    writeFileSync(join(wf, "tasks", "judge.md"), "Pass.\n")
    const engine = createEngine({ home })
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.ok?.status).toBe("succeeded")
    engine.close()
  })

  it("repeats until an agent judge passes", async () => {
    const home = tempHome()
    const marker = join(home, "judge-calls")
    installJudgeStub(home, { name: "claude", exitCode: 0, marker })
    // First judge fail via a wrapper: exit 1 until produce wrote score>=0.8
    // Simpler: until uses agent that always passes after first success.
    const wf = writeWorkflow(
      home,
      "judge-until",
      `
id: judge-until
tasks:
  - id: work
    kind: command
    run: "printf '{\\"score\\":1}' > \\"$TASK_OUT/score.json\\""
    repeat:
      max: 3
      until:
        agent:
          cli: claude
          instructions: tasks/judge.md
`
    )
    writeFileSync(join(wf, "tasks", "judge.md"), "Pass when score is ready.\n")
    const engine = createEngine({ home })
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.work?.status).toBe("succeeded")
    expect(state.tasks.work?.attempts.length).toBe(1)
    engine.close()
  })

  it("does not call the agent when a cheap all sibling fails", async () => {
    const home = tempHome()
    const marker = join(home, "judge-calls")
    writeFileSync(marker, "")
    installJudgeStub(home, { name: "claude", exitCode: 0, marker })
    const wf = writeWorkflow(
      home,
      "judge-cheap",
      `
id: judge-cheap
tasks:
  - id: produce
    kind: command
    run: "exit 1"
    continueOnError: true
  - id: next
    kind: command
    run: "printf next > \\"$TASK_OUT/n.txt\\""
    needs:
      - task: produce
        when:
          all:
            - exit: 0
            - agent:
                cli: claude
                instructions: tasks/judge.md
`
    )
    writeFileSync(join(wf, "tasks", "judge.md"), "Should not run.\n")
    const engine = createEngine({ home })
    const state = await engine.startRun({ workflowDir: wf, runId: "r1" }).wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.next?.status).toBe("skipped")
    expect(state.tasks.next?.skipReason).toBe("branch")
    expect(readFileSync(marker, "utf8")).toBe("")
    engine.close()
  })
})
