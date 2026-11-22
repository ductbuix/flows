import { describe, expect, it } from "vitest"
import type { RunDetail } from "@workspace/shared"
import { defaultTask } from "./RunViewPage"

function run(statuses: string[]): RunDetail {
  return {
    tasks: statuses.map((status, i) => ({ id: `t${i}`, status })),
  } as unknown as RunDetail
}

describe("defaultTask", () => {
  it("prefers failed, then waiting, then running, then last finished", () => {
    expect(defaultTask(run(["succeeded", "failed", "running"]))?.id).toBe("t1")
    expect(
      defaultTask(run(["succeeded", "awaiting_approval", "running"]))?.id
    ).toBe("t1")
    expect(defaultTask(run(["succeeded", "running", "pending"]))?.id).toBe("t1")
    expect(defaultTask(run(["succeeded", "succeeded", "pending"]))?.id).toBe(
      "t1"
    )
  })
})
