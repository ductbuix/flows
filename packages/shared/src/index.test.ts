import { describe, expect, it } from "vitest"
import { healthSchema } from "@workspace/shared"

describe("@workspace/shared re-exports contracts", () => {
  it("exposes healthSchema", () => {
    expect(healthSchema.parse({ ok: true, version: "1.2.3" })).toEqual({
      ok: true,
      version: "1.2.3",
    })
  })
})
