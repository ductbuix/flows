import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearConnectors,
  createEngine,
  fakeConnector,
  registerConnector,
} from "@workspace/engine"
import { libraryListSchema, libraryPullResultSchema } from "@workspace/shared"
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
  const home = mkdtempSync(join(tmpdir(), "flowapp-lib-api-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

describe("library routes", () => {
  it("POST /library/pull and GET /library", async () => {
    const { app } = testStack()

    const createRes = await app.request("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "demo",
        connector: "fake",
        name: "Demo",
        scope: { label: "item-1" },
        signIn: "cli",
        refresh: "1h",
      }),
    })
    expect(createRes.status).toBe(201)

    const pullRes = await app.request("/api/library/pull", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connection: "demo" }),
    })
    expect(pullRes.status).toBe(200)
    const pulled = libraryPullResultSchema.parse(await pullRes.json())
    expect(pulled.entityId).toBe("item-1")
    expect(pulled.revision.length).toBeGreaterThan(0)

    const listRes = await app.request("/api/library")
    expect(listRes.status).toBe(200)
    const listed = libraryListSchema.parse(await listRes.json())
    expect(listed.entities).toHaveLength(1)
    expect(listed.entities[0].entityId).toBe("item-1")
    expect(listed.entities[0].revisions[0]?.current).toBe(true)
  })

  it("returns 404 for unknown connection on pull", async () => {
    const { app } = testStack()
    const res = await app.request("/api/library/pull", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connection: "missing" }),
    })
    expect(res.status).toBe(404)
  })
})
