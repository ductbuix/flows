import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearConnectors,
  createConnection,
  createEngine,
  fakeConnector,
  registerConnector,
} from "@workspace/engine"
import { runChangesResponseSchema } from "@workspace/shared"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

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

describe("GET /runs/:runId/changes/:connectionId", () => {
  it("returns the change set envelope and preview.md", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-changes-"))
    homes.push(home)
    const engine = createEngine({ home })
    const app = createApp({ engine })

    createConnection(home, {
      id: "demo",
      connector: "fake",
      name: "Demo",
      scope: { label: "x" },
      signIn: "cli",
      refresh: "1h",
    })

    const wf = join(home, "workflows", "chg")
    mkdirSync(wf, { recursive: true })
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: chg
tasks:
  - id: a
    kind: command
    uses:
      - { connection: demo, access: propose }
    run: "printf changed > \\"$RESOURCE_DEMO/item/x/data.txt\\""
`
    )

    const handle = await engine.startRun({ workflowDir: wf, runId: "r1" })
    await handle.wait()

    const res = await app.request("/api/runs/r1/changes/demo")
    expect(res.status).toBe(200)
    const body = runChangesResponseSchema.parse(await res.json())
    expect(body.changeSet.connection).toBe("demo")
    expect(body.changeSet.ops.length).toBeGreaterThan(0)
    expect(body.previewMd).toMatch(/Changes for demo/)
    engine.close()
  })
})
