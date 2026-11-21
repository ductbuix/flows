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
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { createEngine } from "./engine.ts"
import { summarizeRun } from "./run-summary.ts"

const homes: string[] = []
const prevPath = process.env.PATH

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  process.env.PATH = prevPath
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-review-"))
  homes.push(home)
  return home
}

function installJudgeStub(
  home: string,
  opts: { exitCode: number; sleepSec?: number; writeReason?: string }
): void {
  const bin = join(home, "bin")
  mkdirSync(bin, { recursive: true })
  const sleep = opts.sleepSec ? `sleep ${opts.sleepSec}\n` : ""
  const reason = opts.writeReason
    ? `printf '%s' '${opts.writeReason}' > review-reason.txt\n`
    : ""
  writeFileSync(
    join(bin, "claude"),
    `#!/bin/sh\n${reason}${sleep}exit ${opts.exitCode}\n`,
    { mode: 0o755 }
  )
  writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
}

function writeConn(home: string, policy: "trust-agent-review") {
  const result = createConnection(home, {
    id: "demo",
    connector: "fake",
    name: "demo",
    scope: { label: "v1" },
    signIn: "cli",
    refresh: "1h",
    policy,
  })
  expect(result.ok).toBe(true)
}

function writeWorkflow(home: string, id: string, body: string): string {
  const wf = join(home, "workflows", id)
  mkdirSync(wf, { recursive: true })
  writeFileSync(join(wf, "workflow.yaml"), body)
  return wf
}

function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("timed out waiting"))
        return
      }
      setTimeout(tick, 25)
    }
    tick()
  })
}

function reviewWorkflowYaml(id: string, extra = ""): string {
  return `
id: ${id}
${extra}
tasks:
  - id: edit
    kind: command
    name: tweak the item
    uses:
      - { connection: demo, access: propose }
    run: "echo changed > \\"$RESOURCE_DEMO/item/v1/data.txt\\""
  - id: ship
    kind: publish
    connection: demo
    needs: [edit]
    timeout: 2
`
}

describe("trust-agent-review publish policy", () => {
  it("approves and publishes with no pause", async () => {
    const home = tempHome()
    writeConn(home, "trust-agent-review")
    installJudgeStub(home, { exitCode: 0, writeReason: "looks safe" })
    const reviewMd = join(home, "connections", "demo", "review.md")
    writeFileSync(reviewMd, "Prefer draft PRs only.\n")
    const wf = writeWorkflow(home, "rev-ok", reviewWorkflowYaml("rev-ok"))
    const engine = createEngine({ home })
    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.ship?.status).toBe("succeeded")
    expect(state.tasks.ship?.reviewVerdict).toBe("approve")
    expect(state.tasks.ship?.reviewReason).toBe("looks safe")

    const review = engine
      .events("r1")
      .find((e) => e.type === "agent_review_finished")
    expect(review).toMatchObject({
      type: "agent_review_finished",
      verdict: "approve",
      reason: "looks safe",
      connection: "demo",
    })
    expect(
      engine.events("r1").some((e) => e.type === "approval_requested")
    ).toBe(false)

    const goals = readFileSync(
      join(wf, "runs", "r1", "changes", "ship", "goals.md"),
      "utf8"
    )
    expect(goals).toMatch(/tweak the item/)
    expect(
      existsSync(join(wf, "runs", "r1", "changes", "ship", "review.md"))
    ).toBe(true)
    engine.close()
  }, 20_000)

  it("escalates and waits for a person", async () => {
    const home = tempHome()
    writeConn(home, "trust-agent-review")
    installJudgeStub(home, { exitCode: 1, writeReason: "risky" })
    const wf = writeWorkflow(home, "rev-esc", reviewWorkflowYaml("rev-esc"))
    const engine = createEngine({ home })
    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    expect(handle.state().tasks.ship?.reviewVerdict).toBe("escalate")
    expect(handle.state().tasks.ship?.reviewReason).toBe("risky")
    expect(summarizeRun(handle.state())?.needsYou).toEqual([
      { taskId: "ship", connectionId: "demo" },
    ])

    engine.approveTask("r1", "ship")
    const state = await handle.wait()
    expect(state.tasks.ship?.status).toBe("succeeded")
    engine.close()
  }, 20_000)

  it("times out and waits for a person", async () => {
    const home = tempHome()
    writeConn(home, "trust-agent-review")
    installJudgeStub(home, { exitCode: 0, sleepSec: 30 })
    const wf = writeWorkflow(
      home,
      "rev-to",
      `
id: rev-to
tasks:
  - id: edit
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "echo changed > \\"$RESOURCE_DEMO/item/v1/data.txt\\""
  - id: ship
    kind: publish
    connection: demo
    needs: [edit]
    timeout: 1
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval",
      10_000
    )
    expect(handle.state().tasks.ship?.reviewVerdict).toBe("escalate")
    expect(handle.state().tasks.ship?.reviewReason).toBe("timeout")
    engine.rejectTask("r1", "ship")
    const state = await handle.wait()
    expect(state.tasks.ship?.failReason).toBe("rejected")
    engine.close()
  }, 20_000)

  it("destructive ops escalate without waiting on the judge", async () => {
    const home = tempHome()
    writeConn(home, "trust-agent-review")
    const marker = join(home, "judge-ran")
    const bin = join(home, "bin")
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, "claude"),
      `#!/bin/sh\nprintf ran > "${marker}"\nexit 0\n`,
      { mode: 0o755 }
    )
    writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
    process.env.PATH = `${bin}:${process.env.PATH ?? ""}`

    const wf = writeWorkflow(
      home,
      "rev-dest",
      `
id: rev-dest
tasks:
  - id: edit
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "printf '__destructive__' > \\"$RESOURCE_DEMO/item/v1/wipe.destructive\\""
  - id: ship
    kind: publish
    connection: demo
    needs: [edit]
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({
      workflowDir: wf,
      runId: "r1",
      trustGrant: "once",
    })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    expect(handle.state().tasks.ship?.reviewVerdict).toBe("escalate")
    expect(handle.state().tasks.ship?.reviewReason).toBe("destructive")
    expect(existsSync(marker)).toBe(false)
    engine.approveTask("r1", "ship")
    const state = await handle.wait()
    expect(state.tasks.ship?.status).toBe("succeeded")
    engine.close()
  }, 20_000)
})
