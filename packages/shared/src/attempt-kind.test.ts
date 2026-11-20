import { describe, expect, it } from "vitest"
import { deriveAttemptKind } from "./attempt-kind.ts"
import type { Task } from "./workflow.ts"

const command = (overrides: Partial<Task> = {}): Task =>
  ({
    id: "t",
    kind: "command",
    run: "true",
    ...overrides,
  }) as Task

describe("deriveAttemptKind", () => {
  it("labels the first attempt as Run", () => {
    const info = deriveAttemptKind(command(), [{ attempt: 1 }], 0)
    expect(info).toMatchObject({ kind: "run", label: "Run" })
  })

  it("labels interrupted attempts", () => {
    const info = deriveAttemptKind(
      command({ retry: { max: 2 } }),
      [{ attempt: 1, interrupted: true }],
      0
    )
    expect(info.kind).toBe("interrupted")
    expect(info.label).toBe("Interrupted")
  })

  it("labels retry after failure with n/max", () => {
    const task = command({ retry: { max: 3 } })
    const attempts = [{ attempt: 1, exitCode: 1 }, { attempt: 2 }]
    const info = deriveAttemptKind(task, attempts, 1)
    expect(info).toMatchObject({
      kind: "retry",
      label: "Retry 2/3",
      n: 2,
      max: 3,
    })
    expect(info.ariaLabel).toContain("Retry 2 of 3")
  })

  it("labels repeat after success with n/max", () => {
    const task = command({
      repeat: { max: 5, until: { expr: "false" } },
    })
    const attempts = [{ attempt: 1, exitCode: 0 }, { attempt: 2 }]
    const info = deriveAttemptKind(task, attempts, 1)
    expect(info).toMatchObject({
      kind: "repeat",
      label: "Repeat 2/5",
      n: 2,
      max: 5,
    })
  })

  it("labels manual retry without counting against retry.max", () => {
    const task = command({ retry: { max: 2 } })
    const attempts = [
      { attempt: 1, exitCode: 1 },
      { attempt: 2, exitCode: 1 },
      { attempt: 3, exitCode: 1 },
      { attempt: 4, manualRetry: true },
    ]
    const info = deriveAttemptKind(task, attempts, 3)
    expect(info).toMatchObject({
      kind: "manual_retry",
      label: "Manual retry",
    })
  })
})
