import { describe, expect, it } from "vitest"
import {
  DEFAULT_ATTEMPT_TIMEOUT_SECONDS,
  remainingTimeoutMs,
  resolveAttemptTimeout,
} from "./timeout.ts"

describe("resolveAttemptTimeout", () => {
  it("uses task, then workflow, then 900", () => {
    expect(resolveAttemptTimeout({}, {})).toBe(DEFAULT_ATTEMPT_TIMEOUT_SECONDS)
    expect(resolveAttemptTimeout({}, { timeout: 120 })).toBe(120)
    expect(resolveAttemptTimeout({ timeout: 30 }, { timeout: 120 })).toBe(30)
  })
})

describe("remainingTimeoutMs", () => {
  it("returns remaining and negative when overdue", () => {
    const started = new Date("2026-01-01T00:00:00.000Z").toISOString()
    const atStart = Date.parse(started)
    expect(remainingTimeoutMs(started, 10, atStart)).toBe(10_000)
    expect(remainingTimeoutMs(started, 10, atStart + 4_000)).toBe(6_000)
    expect(remainingTimeoutMs(started, 10, atStart + 15_000)).toBe(-5_000)
  })
})
