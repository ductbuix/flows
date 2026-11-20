import { healthSchema } from "@workspace/shared"
import { describe, expect, it } from "vitest"
import { app } from "./app.ts"

describe("GET /api/health", () => {
  it("returns ok and a version", async () => {
    const res = await app.request("/api/health")
    expect(res.status).toBe(200)
    expect(healthSchema.parse(await res.json())).toEqual({
      ok: true,
      version: "0.0.1",
    })
  })

  it("returns 404 for unknown routes", async () => {
    const res = await app.request("/api/nope")
    expect(res.status).toBe(404)
  })
})
