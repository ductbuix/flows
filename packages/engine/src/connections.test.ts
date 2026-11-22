import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearConnectors,
  fakeConnector,
  registerConnector,
} from "./connectors/index.ts"
import {
  createConnection,
  deleteConnection,
  listConnections,
  readConnection,
  updateConnection,
  workflowsUsingConnection,
} from "./connections.ts"
import { secretsDir } from "./paths.ts"

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

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-conn-"))
  dirs.push(home)
  return home
}

const base = {
  connector: "fake",
  name: "Test",
  scope: { label: "x" },
  signIn: "cli" as const,
  refresh: "1h" as const,
}

describe("connections store", () => {
  it("creates, lists, updates and deletes a connection", () => {
    const home = tempHome()
    const created = createConnection(home, { ...base, id: "github-acme" })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value.policy).toBe("read-only")
    expect(listConnections(home).map((c) => c.id)).toEqual(["github-acme"])

    const updated = updateConnection(home, "github-acme", {
      ...created.value,
      name: "Acme",
      policy: "approve-each-publish",
    })
    expect(updated.ok).toBe(true)
    expect(readConnection(home, "github-acme")?.name).toBe("Acme")

    const deleted = deleteConnection(home, "github-acme")
    expect(deleted.ok).toBe(true)
    expect(readConnection(home, "github-acme")).toBeUndefined()
  })

  it("returns env_conflict when directory names map to the same RESOURCE_*", () => {
    const home = tempHome()
    mkdirSync(join(home, "connections", "a_b"), { recursive: true })
    writeFileSync(
      join(home, "connections", "a_b", "connection.yaml"),
      "id: a_b\nconnector: fake\nname: x\nsignIn: cli\nrefresh: never\n"
    )
    const result = createConnection(home, { ...base, id: "a-b" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe("env_conflict")
  })

  it("rejects delete while a workflow uses the connection and removes secrets", () => {
    const home = tempHome()
    createConnection(home, { ...base, id: "rally-payments" })
    mkdirSync(secretsDir(home, "rally-payments"), { recursive: true })
    writeFileSync(
      join(secretsDir(home, "rally-payments"), "cookies.json"),
      "{}"
    )

    const wf = join(home, "workflows", "demo")
    mkdirSync(wf, { recursive: true })
    writeFileSync(
      join(wf, "workflow.yaml"),
      `
id: demo
nodes:
  - id: lib
    kind: asset
    resources:
      - { connection: rally-payments, entity: page, id: "1" }
edges: []
`
    )
    expect(workflowsUsingConnection(home, "rally-payments")).toEqual(["demo"])
    const blocked = deleteConnection(home, "rally-payments")
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error.kind).toBe("in_use")

    rmSync(join(wf, "workflow.yaml"))
    const deleted = deleteConnection(home, "rally-payments")
    expect(deleted.ok).toBe(true)
    expect(existsSync(secretsDir(home, "rally-payments"))).toBe(false)
  })

  it("rejects an unknown connector", () => {
    const home = tempHome()
    const result = createConnection(home, {
      ...base,
      id: "x",
      connector: "nope",
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe("unknown_connector")
  })
})
