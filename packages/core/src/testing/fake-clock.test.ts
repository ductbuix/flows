import { describe, expect, it } from "vitest"
import { createFakeClock } from "./fake-clock.ts"

describe("FakeClock", () => {
  it("starts at given time and advances", () => {
    const clock = createFakeClock(1_000)
    expect(clock.now()).toBe(1_000)
    clock.advance(250)
    expect(clock.now()).toBe(1_250)
    clock.set(5_000)
    expect(clock.now()).toBe(5_000)
  })
})
