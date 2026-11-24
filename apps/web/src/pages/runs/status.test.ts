import { describe, expect, it } from "vitest"
import { statusOf } from "./status"

describe("statusOf", () => {
  it("maps needsYou over status", () => {
    expect(statusOf("running", true)).toEqual({
      tone: "attention",
      label: "Needs you",
    })
  })

  it("maps each run status", () => {
    expect(statusOf("queued", false).label).toBe("Queued")
    expect(statusOf("running", false).tone).toBe("working")
    expect(statusOf("succeeded", false).tone).toBe("done")
    expect(statusOf("failed", false).tone).toBe("failed")
    expect(statusOf("cancelled", false).label).toBe("Cancelled")
  })
})
