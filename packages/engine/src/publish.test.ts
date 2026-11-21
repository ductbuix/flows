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
import { parseWorkflowYaml } from "@workspace/shared"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { createEngine } from "./engine.ts"
import { EventLog } from "./event-log.ts"
import { foldEvents } from "./fold.ts"
import { appDbPath } from "./paths.ts"
import { assertPublishTasksValid } from "./publish.ts"
import { summarizeRun } from "./run-summary.ts"
import { workPublishBaseDir } from "./work-copy.ts"

const homes: string[] = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-publish-"))
  homes.push(home)
  return home
}

function writeConn(
  home: string,
  id: string,
  scope: Record<string, string>,
  policy: "read-only" | "approve-each-publish" = "approve-each-publish"
) {
  const result = createConnection(home, {
    id,
    connector: "fake",
    name: id,
    scope,
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

function publishWorkflowYaml(id: string): string {
  return `
id: ${id}
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
`
}

describe("publish task", () => {
  it("rejects read-only connections at load", () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" }, "read-only")
    writeWorkflow(home, "ro", publishWorkflowYaml("ro"))
    const engine = createEngine({ home })
    expect(() => engine.loadWorkflow(join(home, "workflows", "ro"))).toThrow(
      /read-only/
    )
    engine.close()
  })

  it("assertPublishTasksValid fails for read-only", () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" }, "read-only")
    const parsed = parseWorkflowYaml(publishWorkflowYaml("ro-assert"))
    expect(parsed.workflow).not.toBeNull()
    expect(() => assertPublishTasksValid(home, parsed.workflow!)).toThrow(
      /read-only/
    )
  })

  it("empty change set succeeds with nothing sent", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "empty-pub",
      `
id: empty-pub
tasks:
  - id: edit
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "true"
  - id: ship
    kind: publish
    connection: demo
    needs: [edit]
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.ship?.status).toBe("succeeded")
    const events = engine.events("r1")
    expect(events.some((e) => e.type === "publish_started")).toBe(false)
    expect(existsSync(join(wf, "runs", "r1", "changes", "ship"))).toBe(true)
    engine.close()
  }, 20_000)

  it("waits under approve-each-publish; approve applies; needsYou has connection", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(home, "pub-wf", publishWorkflowYaml("pub-wf"))
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })

    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    const summary = summarizeRun(handle.state())
    expect(summary?.needsYou).toEqual([
      { taskId: "ship", connectionId: "demo" },
    ])
    expect(
      existsSync(join(wf, "runs", "r1", "changes", "ship", "preview.md"))
    ).toBe(true)

    engine.approveTask("r1", "ship")
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.ship?.status).toBe("succeeded")

    const resultPath = join(
      wf,
      "runs",
      "r1",
      "tasks",
      "ship",
      "attempt-1",
      "out",
      "result.json"
    )
    expect(existsSync(resultPath)).toBe(true)
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as {
      url: string
    }
    expect(result.url).toMatch(/example\.test/)

    const finished = engine
      .events("r1")
      .find((e) => e.type === "publish_finished")
    expect(finished).toMatchObject({
      type: "publish_finished",
      status: "applied",
      impact: "cloud",
      connection: "demo",
    })
    expect(finished && "undoNote" in finished && finished.undoNote).toMatch(
      /Close the fake PR/
    )
    expect(existsSync(workPublishBaseDir(join(wf, "runs", "r1"), "demo"))).toBe(
      true
    )
    engine.close()
  }, 20_000)

  it("reject fails the publish task with reason rejected", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "pub-reject",
      publishWorkflowYaml("pub-reject")
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    engine.rejectTask("r1", "ship")
    const state = await handle.wait()
    expect(state.tasks.ship?.status).toBe("failed")
    expect(state.tasks.ship?.failReason).toBe("rejected")
    expect(state.status).toBe("failed")
    engine.close()
  }, 20_000)

  it("conflict and rejected connector results fail the task", async () => {
    for (const mode of ["conflict", "rejected"] as const) {
      const home = tempHome()
      writeConn(home, "demo", { label: "v1", publishResult: mode })
      const wf = writeWorkflow(
        home,
        `pub-${mode}`,
        publishWorkflowYaml(`pub-${mode}`)
      )
      const engine = createEngine({ home })
      const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
      await waitFor(
        () => handle.state().tasks.ship?.status === "awaiting_approval"
      )
      engine.approveTask("r1", "ship")
      const state = await handle.wait()
      expect(state.tasks.ship?.status).toBe("failed")
      expect(state.tasks.ship?.failReason).toBe(mode)
      engine.close()
    }
  }, 30_000)

  it("destructive ops wait even when building the change set", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "destructive",
      `
id: destructive
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
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    const preview = readFileSync(
      join(wf, "runs", "r1", "changes", "ship", "preview.md"),
      "utf8"
    )
    expect(preview).toMatch(/destructive/)
    engine.approveTask("r1", "ship")
    const state = await handle.wait()
    expect(state.tasks.ship?.status).toBe("succeeded")
    engine.close()
  }, 20_000)

  it("second publish task sends only newer changes", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "two-pub",
      `
id: two-pub
tasks:
  - id: edit1
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "echo first > \\"$RESOURCE_DEMO/item/v1/data.txt\\""
  - id: ship1
    kind: publish
    connection: demo
    needs: [edit1]
  - id: edit2
    kind: command
    needs: [ship1]
    uses:
      - { connection: demo, access: propose }
    run: "echo second > \\"$RESOURCE_DEMO/item/v1/data.txt\\""
  - id: ship2
    kind: publish
    connection: demo
    needs: [edit2]
`
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })

    await waitFor(
      () => handle.state().tasks.ship1?.status === "awaiting_approval"
    )
    engine.approveTask("r1", "ship1")
    await waitFor(
      () => handle.state().tasks.ship2?.status === "awaiting_approval"
    )

    const cs2 = JSON.parse(
      readFileSync(
        join(wf, "runs", "r1", "changes", "ship2", "changeset.json"),
        "utf8"
      )
    ) as { ops: Array<{ target: string; payload?: { after?: string } }> }
    expect(cs2.ops).toHaveLength(1)
    expect(cs2.ops[0]?.payload?.after).toMatch(/second/)

    engine.approveTask("r1", "ship2")
    const state = await handle.wait()
    expect(state.status).toBe("succeeded")
    expect(state.tasks.ship1?.status).toBe("succeeded")
    expect(state.tasks.ship2?.status).toBe("succeeded")

    const pubs = engine
      .events("r1")
      .filter((e) => e.type === "publish_finished" && e.status === "applied")
    expect(pubs).toHaveLength(2)
    engine.close()
  }, 30_000)

  it("waiting publish survives resume", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "resume-pub",
      publishWorkflowYaml("resume-pub")
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    engine.close()

    const engine2 = createEngine({ home })
    const resumed = engine2.resumeRun("r1")
    expect(resumed).not.toBeNull()
    expect(resumed!.state().tasks.ship?.status).toBe("awaiting_approval")
    engine2.approveTask("r1", "ship")
    const state = await resumed!.wait()
    expect(state.tasks.ship?.status).toBe("succeeded")
    engine2.close()
  }, 30_000)

  it("resume after publish_started checks the connector before finishing", async () => {
    const home = tempHome()
    writeConn(home, "demo", { label: "v1" })
    const wf = writeWorkflow(
      home,
      "resume-mid",
      publishWorkflowYaml("resume-mid")
    )
    const engine = createEngine({ home })
    const handle = await engine.startRun({ workflowDir: wf, runId: "r2" })
    await waitFor(
      () => handle.state().tasks.ship?.status === "awaiting_approval"
    )
    const changeSetPath = join(
      wf,
      "runs",
      "r2",
      "changes",
      "ship",
      "changeset.json"
    )
    expect(existsSync(changeSetPath)).toBe(true)
    engine.close()

    // Crash after approve + publish_started, before publish_finished.
    const log = new EventLog(appDbPath(home))
    const at = new Date().toISOString()
    log.append({
      type: "task_approved",
      runId: "r2",
      taskId: "ship",
      at,
    })
    log.append({
      type: "publish_started",
      runId: "r2",
      taskId: "ship",
      connection: "demo",
      at,
    })
    log.close()

    const peek = new EventLog(appDbPath(home))
    const mid = foldEvents(peek.listByRun("r2").map((e) => e.event))
    peek.close()
    expect(mid?.tasks.ship?.status).toBe("running")

    const engine2 = createEngine({ home })
    const resumed = engine2.resumeRun("r2")
    expect(resumed).not.toBeNull()
    const state = await resumed!.wait()
    const finished = engine2
      .events("r2")
      .filter((e) => e.type === "publish_finished")
    expect(finished[0]).toMatchObject({ status: "applied", impact: "cloud" })
    expect(state.tasks.ship?.status).toBe("succeeded")
    const changeSet = JSON.parse(readFileSync(changeSetPath, "utf8"))
    const again = await fakeConnector.publish(
      {
        id: "demo",
        connector: "fake",
        name: "demo",
        scope: { label: "v1" },
        signIn: "cli",
        refresh: "1h",
        policy: "approve-each-publish",
        serial: false,
      },
      changeSet,
      home
    )
    expect(again.status).toBe("applied")
    engine2.close()
  }, 30_000)
})
