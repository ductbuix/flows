import { describe, expect, it } from "vitest"
import { isSafeTaskId, upstreamEnvName } from "./task-ids.ts"

describe("task id helpers (DES-020)", () => {
  it("accepts legacy and generated ids; rejects path segments and leading dot", () => {
    expect(isSafeTaskId("start")).toBe(true)
    expect(isSafeTaskId("analyze-ticket")).toBe(true)
    expect(isSafeTaskId("task-3f9a1c2e")).toBe(true)
    expect(isSafeTaskId("a/b")).toBe(false)
    expect(isSafeTaskId("..")).toBe(false)
    expect(isSafeTaskId(".")).toBe(false)
    expect(isSafeTaskId(".trash")).toBe(false)
    expect(isSafeTaskId(".hidden")).toBe(false)
    expect(isSafeTaskId("a\\b")).toBe(false)
  })

  it("maps upstream env names by replacing hyphens", () => {
    expect(upstreamEnvName("task-3f9a1c2e")).toBe("UPSTREAM_task_3f9a1c2e")
    expect(upstreamEnvName("analyze-ticket")).toBe("UPSTREAM_analyze_ticket")
    expect(upstreamEnvName("start")).toBe("UPSTREAM_start")
  })
})
