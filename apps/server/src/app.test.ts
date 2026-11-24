import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHost } from "@workspace/adapters-node"
import { healthSchema } from "@workspace/contracts"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function testStack() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-srv-"))
  homes.push(home)
  const engine = createHost({ home })
  const app = createApp({ engine })
  return { engine, app }
}

describe("GET /health", () => {
  it("returns ok and a version", async () => {
    const { engine, app } = testStack()
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    expect(healthSchema.parse(await res.json())).toEqual({
      ok: true,
      version: "0.0.1",
    })
    engine.close()
  })

  it("returns 404 for unknown routes", async () => {
    const { engine, app } = testStack()
    const res = await app.request("/api/nope")
    expect(res.status).toBe(404)
    engine.close()
  })
})
