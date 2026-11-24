import { describe, expect, it } from "vitest"
import { rankBetween } from "./rank.ts"

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), state | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function expectBetween(
  lower: string | undefined,
  key: string,
  upper: string | undefined
) {
  if (lower !== undefined) {
    expect(key > lower).toBe(true)
  }
  if (upper !== undefined) {
    expect(key < upper).toBe(true)
  }
}

describe("rankBetween", () => {
  it("returns a midpoint with no bounds", () => {
    const key = rankBetween()
    expect(key.length).toBe(1)
    expectBetween(undefined, key, undefined)
  })

  it("respects column start and end", () => {
    const first = rankBetween(undefined, "m")
    expectBetween(undefined, first, "m")
    const last = rankBetween("m", undefined)
    expectBetween("m", last, undefined)
  })

  it("stays strictly between two keys", () => {
    const key = rankBetween("a", "z")
    expectBetween("a", key, "z")
  })

  it("rejects unordered bounds", () => {
    expect(() => rankBetween("z", "a")).toThrow(/lower bound/)
    expect(() => rankBetween("same", "same")).toThrow(/lower bound/)
  })

  it("rejects keys ending in the smallest digit", () => {
    expect(() => rankBetween("a0", "b")).toThrow(/smallest digit/)
  })

  it("keeps keys ordered through 10 000 random inserts", () => {
    const rand = mulberry32(0x0152_5eed)
    const keys: string[] = [rankBetween()]

    for (let n = 0; n < 10_000; n++) {
      const slot = Math.floor(rand() * (keys.length + 1))
      const lower = slot > 0 ? keys[slot - 1] : undefined
      const upper = slot < keys.length ? keys[slot] : undefined
      const key = rankBetween(lower, upper)
      expectBetween(lower, key, upper)
      keys.splice(slot, 0, key)
    }

    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1]! < keys[i]!).toBe(true)
    }

    const maxLen = keys.reduce((max, k) => Math.max(max, k.length), 0)
    expect(maxLen).toBeLessThan(48)
  })
})
