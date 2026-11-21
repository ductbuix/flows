import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearConnectors,
  createEngine,
  fakeConnector,
  registerConnector,
} from "@workspace/engine"
import {
  connectionCheckResultSchema,
  connectionSchema,
  connectionsListSchema,
  connectorsListSchema,
} from "@workspace/shared"
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

function testStack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-conn-api-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

const body = {
  id: "github-acme",
  connector: "fake",
  name: "Acme",
  scope: { owner: "acme" },
  signIn: "cli" as const,
  refresh: "15m" as const,
}

describe("connection routes", () => {
  it("lists connectors and CRUD connections with check", async () => {
    const { app } = testStack()

    const connectorsRes = await app.request("/api/connectors")
    expect(connectorsRes.status).toBe(200)
    const connectors = connectorsListSchema.parse(await connectorsRes.json())
    expect(connectors.connectors.some((c) => c.id === "fake")).toBe(true)

    const createRes = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    expect(createRes.status).toBe(201)
    expect(connectionSchema.parse(await createRes.json()).id).toBe(
      "github-acme"
    )

    const listRes = await app.request("/api/connections")
    expect(
      connectionsListSchema.parse(await listRes.json()).connections
    ).toHaveLength(1)

    const getRes = await app.request("/api/connections/github-acme")
    expect(getRes.status).toBe(200)

    const putRes = await app.request("/api/connections/github-acme", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, name: "Acme API" }),
    })
    expect(putRes.status).toBe(200)
    expect(connectionSchema.parse(await putRes.json()).name).toBe("Acme API")

    const checkRes = await app.request("/api/connections/github-acme/check", {
      method: "POST",
    })
    expect(checkRes.status).toBe(200)
    expect(connectionCheckResultSchema.parse(await checkRes.json()).ok).toBe(
      true
    )

    const delRes = await app.request("/api/connections/github-acme", {
      method: "DELETE",
    })
    expect(delRes.status).toBe(204)
  })

  it("returns 409 on env name conflict and while in use", async () => {
    const { app, home } = testStack()

    mkdirSync(join(home, "connections", "a_b"), { recursive: true })
    const conflictRes = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, id: "a-b" }),
    })
    expect(conflictRes.status).toBe(409)
    const conflictBody = (await conflictRes.json()) as { message: string }
    expect(conflictBody.message).toBe("env_conflict")

    const created = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    expect(created.status).toBe(201)

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
      - { connection: github-acme, access: read }
`
    )
    const delRes = await app.request("/api/connections/github-acme", {
      method: "DELETE",
    })
    expect(delRes.status).toBe(409)
    const delBody = (await delRes.json()) as { message: string }
    expect(delBody.message).toBe("in_use")
  })

  it("rejects secret fields in the body", async () => {
    const { app } = testStack()
    const res = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, token: "nope" }),
    })
    expect(res.status).toBe(400)
  })
})
