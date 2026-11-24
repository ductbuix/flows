import { describe, expect, it } from "vitest"
import { ErrorCode } from "@workspace/contracts"
import { errorMessage, isConflictError } from "./fcp-error"

describe("fcp-error", () => {
  it("detects conflict by numeric code or data.code", () => {
    expect(isConflictError({ code: ErrorCode.conflict })).toBe(true)
    expect(isConflictError({ data: { code: "conflict" } })).toBe(true)
    expect(isConflictError({ code: ErrorCode.not_found })).toBe(false)
    expect(isConflictError(null)).toBe(false)
  })

  it("reads Error messages", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom")
    expect(errorMessage("x")).toBe("x")
  })
})
