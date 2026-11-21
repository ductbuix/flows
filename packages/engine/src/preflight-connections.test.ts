import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import { createConnection } from "./connections.ts"
import { checkConnectionUses } from "./preflight-connections.ts"
import { loadWorkflowFile } from "./workflow.ts"

const dirs: string[] = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("checkConnectionUses", () => {
  it("warns on unknown connection and ambient login, not propose", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pf-conn-"))
    dirs.push(home)
    createConnection(home, {
      id: "github-acme",
      connector: "fake",
      name: "Acme",
      scope: { ambient: "gh session" },
      signIn: "cli",
      refresh: "1h",
    })

    const wf = join(home, "workflows", "demo")
    mkdirSync(wf, { recursive: true })
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: demo
tasks:
  - id: a
    kind: command
    run: echo
    uses:
      - { connection: missing-one, access: read }
      - { connection: github-acme, access: propose }
`
    )
    const workflow = loadWorkflowFile(wf)
    const checks = await checkConnectionUses({ home, workflow })
    expect(checks.some((c) => c.id === "connection_unknown_missing-one")).toBe(
      true
    )
    expect(checks.some((c) => c.id.startsWith("connection_propose_"))).toBe(
      false
    )
    expect(
      checks.find((c) => c.id === "connection_ambient_github-acme")?.message
    ).toMatch(/gh session/)
  })
})
