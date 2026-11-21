import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearConnectors,
  createEngine,
  fakeConnector,
  registerConnector,
  secretsDir,
  writeCookies,
} from "@workspace/engine"
import {
  connectionCheckResultSchema,
  connectionSchema,
  connectionSignInStatusSchema,
  connectionsListSchema,
  connectorsListSchema,
} from "@workspace/shared"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []
const engines: Array<{ close: () => void }> = []

beforeEach(() => {
  registerConnector(fakeConnector)
})

afterEach(() => {
  clearConnectors()
  for (const engine of engines.splice(0)) {
    engine.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function testStack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-conn-api-"))
  homes.push(home)
  const engine = createEngine({ home })
  engines.push(engine)
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

  it("reports sign-in status and remove sign-in clears secrets", async () => {
    const { app, home } = testStack()
    const cookieBody = {
      id: "rally-payments",
      connector: "fake",
      name: "Rally",
      scope: { domain: "example.com" },
      signIn: "cookies" as const,
      refresh: "never" as const,
    }
    const created = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cookieBody),
    })
    expect(created.status).toBe(201)

    const before = await app.request("/api/connections/rally-payments/sign-in")
    expect(before.status).toBe(200)
    expect(
      connectionSignInStatusSchema.parse(await before.json()).signedIn
    ).toBe(false)

    writeCookies(home, "rally-payments", [
      {
        name: "sid",
        value: "session",
        domain: "example.com",
        path: "/",
      },
    ])
    const afterWrite = await app.request(
      "/api/connections/rally-payments/sign-in"
    )
    expect(
      connectionSignInStatusSchema.parse(await afterWrite.json()).signedIn
    ).toBe(true)

    const checkRes = await app.request(
      "/api/connections/rally-payments/check",
      { method: "POST" }
    )
    expect(connectionCheckResultSchema.parse(await checkRes.json()).ok).toBe(
      true
    )

    const removeRes = await app.request(
      "/api/connections/rally-payments/sign-in",
      { method: "DELETE" }
    )
    expect(removeRes.status).toBe(204)
    expect(existsSync(secretsDir(home, "rally-payments"))).toBe(false)

    const afterRemove = await app.request(
      "/api/connections/rally-payments/sign-in"
    )
    expect(
      connectionSignInStatusSchema.parse(await afterRemove.json()).signedIn
    ).toBe(false)
  })

  it("rejects browser sign-in when method is not cookies", async () => {
    const { app } = testStack()
    await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const res = await app.request(
      "/api/connections/github-acme/sign-in/browser",
      { method: "POST" }
    )
    expect(res.status).toBe(400)
  })
})
