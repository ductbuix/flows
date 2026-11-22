import { describe, expect, it } from "vitest"
import {
  formatAbsolute,
  formatDuration,
  formatRelative,
  humanizeId,
  runLabel,
  workflowLabel,
} from "./labels"

describe("workflowLabel", () => {
  it("prefers name, else humanizes the id", () => {
    expect(workflowLabel({ id: "feature-spec", name: "Spec writer" })).toBe(
      "Spec writer"
    )
    expect(workflowLabel({ id: "feature-spec" })).toBe("Feature spec")
    expect(workflowLabel({ id: "a_b-c", name: "  " })).toBe("A b c")
    expect(humanizeId("x")).toBe("X")
  })
})

describe("runLabel", () => {
  it("uses the work item title, else Ad hoc run", () => {
    expect(runLabel({ workItemTitle: "Fix login" })).toBe("Fix login")
    expect(runLabel({ workItemTitle: undefined })).toBe("Ad hoc run")
    expect(runLabel({ workItemTitle: " " })).toBe("Ad hoc run")
  })
})

describe("formatRelative", () => {
  const now = new Date(2026, 10, 22, 12, 0, 0).getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()
  it("steps through just now, minutes, hours, yesterday, date", () => {
    expect(formatRelative(ago(10_000), now)).toBe("just now")
    expect(formatRelative(ago(3 * 60_000), now)).toBe("3 min ago")
    expect(formatRelative(ago(2 * 3_600_000), now)).toBe("2 h ago")
    expect(formatRelative(new Date(2026, 10, 21, 1).toISOString(), now)).toBe(
      "yesterday"
    )
    expect(
      formatRelative(new Date(2026, 10, 10, 9).toISOString(), now)
    ).toMatch(/Nov|10/)
    expect(formatRelative("nope", now)).toBe("nope")
  })
})

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(45_000)).toBe("45s")
    expect(formatDuration(185_000)).toBe("3m 05s")
    expect(formatDuration(7_800_000)).toBe("2h 10m")
  })
})

describe("formatAbsolute", () => {
  it("includes the zone and falls back for bad input", () => {
    expect(formatAbsolute("2026-11-22T12:00:00Z")).toMatch(/2026/)
    expect(formatAbsolute("nope")).toBe("nope")
  })
})
