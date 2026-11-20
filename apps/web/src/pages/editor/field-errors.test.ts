import { describe, expect, it } from "vitest"
import { taskFieldErrors } from "./field-errors"

describe("taskFieldErrors", () => {
  it("maps diagnostics to the matching task field", () => {
    const errors = [
      {
        message: "Too small",
        path: ["tasks", 1, "run"],
        from: 0,
        to: 1,
        severity: "error" as const,
      },
      {
        message: "other",
        path: ["tasks", 0, "run"],
        from: 0,
        to: 1,
        severity: "error" as const,
      },
      {
        message: "instructions",
        path: ["tasks", 1, "instructions"],
        from: 0,
        to: 1,
        severity: "error" as const,
      },
    ]
    expect(taskFieldErrors(errors, 1, "run")).toEqual([
      { message: "Too small" },
    ])
    expect(taskFieldErrors(errors, 1, "instructions")).toEqual([
      { message: "instructions" },
    ])
    expect(taskFieldErrors(errors, 2, "run")).toEqual([])
  })
})
