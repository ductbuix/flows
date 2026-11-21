import { describe, expect, it } from "vitest"
import {
  findBannedClassTokens,
  findBannedSizeRadiusTokens,
} from "../../eslint-tailwind-guard.js"

describe("findBannedClassTokens", () => {
  it("allows data-/aria-/has-/group- arbitrary variants and scale steps", () => {
    expect(
      findBannedClassTokens("data-[state=open]:bg-muted min-h-40")
    ).toEqual([])
    expect(
      findBannedClassTokens("aria-[invalid=true]:ring-destructive")
    ).toEqual([])
    expect(
      findBannedClassTokens("has-[>svg]:px-2 group-data-[size=sm]:gap-2")
    ).toEqual([])
  })

  it("bans arbitrary utility values and palette colors", () => {
    expect(findBannedClassTokens("min-h-[160px]")).toEqual(["min-h-[160px]"])
    expect(findBannedClassTokens("text-amber-700")).toEqual(["text-amber-700"])
    expect(findBannedClassTokens("dark:text-amber-400 bg-white")).toEqual([
      "dark:text-amber-400",
      "bg-white",
    ])
  })
})

describe("findBannedSizeRadiusTokens", () => {
  it("bans h-*, size-* and rounded-* (with variants)", () => {
    expect(findBannedSizeRadiusTokens("flex h-8 gap-2")).toEqual(["h-8"])
    expect(findBannedSizeRadiusTokens("size-4 rounded-md")).toEqual([
      "size-4",
      "rounded-md",
    ])
    expect(findBannedSizeRadiusTokens("sm:h-7 dark:rounded-xl")).toEqual([
      "sm:h-7",
      "dark:rounded-xl",
    ])
  })

  it("allows min/max height and non-size utilities", () => {
    expect(
      findBannedSizeRadiusTokens("min-h-0 max-h-96 w-full gap-3 font-mono")
    ).toEqual([])
    expect(findBannedSizeRadiusTokens("group-data-[size=sm]:gap-2")).toEqual([])
  })
})
