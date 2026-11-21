import { describe, expect, it } from "vitest"
import {
  GENERATED_TASK_ID_RE,
  isSafeTaskId,
  judgePromptPath,
  newTaskId,
  taskPromptPath,
  upstreamEnvName,
} from "./task-ids.ts"

describe("task id helpers (DES-020)", () => {
  it("newTaskId matches the generated pattern and retries collisions", () => {
    const id = newTaskId()
    expect(id).toMatch(GENERATED_TASK_ID_RE)
    const forced = newTaskId([id])
    expect(forced).toMatch(GENERATED_TASK_ID_RE)
    expect(forced).not.toBe(id)
  })

  it("accepts legacy and generated ids; rejects path segments", () => {
    expect(isSafeTaskId("start")).toBe(true)
    expect(isSafeTaskId("analyze-ticket")).toBe(true)
    expect(isSafeTaskId("task-3f9a1c2e")).toBe(true)
    expect(isSafeTaskId("a/b")).toBe(false)
    expect(isSafeTaskId("..")).toBe(false)
    expect(isSafeTaskId("a\\b")).toBe(false)
  })

  it("derives prompt and judge paths", () => {
    expect(taskPromptPath("start")).toBe("tasks/start/prompt.md")
    expect(judgePromptPath("plan", { kind: "when" })).toBe("tasks/plan/when.md")
    expect(judgePromptPath("plan", { kind: "until" })).toBe(
      "tasks/plan/until.md"
    )
    expect(judgePromptPath("plan", { kind: "need", needTaskId: "fetch" })).toBe(
      "tasks/plan/need-fetch.md"
    )
  })

  it("maps upstream env names by replacing hyphens", () => {
    expect(upstreamEnvName("task-3f9a1c2e")).toBe("UPSTREAM_task_3f9a1c2e")
    expect(upstreamEnvName("analyze-ticket")).toBe("UPSTREAM_analyze_ticket")
    expect(upstreamEnvName("start")).toBe("UPSTREAM_start")
  })
})
