import { describe, expect, it } from "vitest"
import { healthSchema } from "./index"

describe("healthSchema", () => {
  it("accepts a healthy payload", () => {
    expect(healthSchema.parse({ ok: true, version: "1.2.3" })).toEqual({
      ok: true,
      version: "1.2.3",
    })
  })

  it("rejects ok: false and a missing version", () => {
    expect(healthSchema.safeParse({ ok: false, version: "1" }).success).toBe(
      false
    )
    expect(healthSchema.safeParse({ ok: true }).success).toBe(false)
  })
})
