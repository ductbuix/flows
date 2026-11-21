import { describe, expect, it } from "vitest"
import { mapStderrReason, resolveFinishReason } from "./failure-reason.ts"

describe("mapStderrReason", () => {
  it("maps known Cursor patterns and ignores others", () => {
    expect(
      mapStderrReason("error: Failed to create trust marker\n", "cursor")
    ).toBe("Failed to create trust marker")
    expect(
      mapStderrReason("Workspace Trust Required for this path", "cursor")
    ).toBe("Workspace Trust Required")
    expect(mapStderrReason("Failed to trust workspace", "cursor")).toBe(
      "Failed to trust workspace"
    )
    expect(mapStderrReason("Failed to create trust marker", "claude")).toBe(
      undefined
    )
    expect(mapStderrReason("random noise", "cursor")).toBe(undefined)
  })
})

describe("resolveFinishReason", () => {
  it("prefers mapped stderr over timeout", () => {
    expect(
      resolveFinishReason({
        stderr: "Failed to trust workspace\n",
        cli: "cursor",
        timedOut: true,
      })
    ).toBe("Failed to trust workspace")
    expect(
      resolveFinishReason({
        stderr: "",
        cli: "cursor",
        timedOut: true,
      })
    ).toBe("timeout")
    expect(
      resolveFinishReason({
        stderr: "",
        cli: undefined,
        timedOut: false,
      })
    ).toBe(undefined)
  })
})
