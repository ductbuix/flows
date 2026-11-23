import { describe, expect, it } from "vitest"
import { engineError } from "./engine-error.ts"
import {
  andThen,
  err,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  unwrapOr,
} from "./result.ts"

describe("Result helpers", () => {
  const failure = err(engineError("not_found", "missing"))

  it("ok and err discriminate", () => {
    expect(isOk(ok(1))).toBe(true)
    expect(isErr(ok(1))).toBe(false)
    expect(isOk(failure)).toBe(false)
    expect(isErr(failure)).toBe(true)
  })

  it("map transforms success only", () => {
    expect(map(ok(2), (n) => n + 1)).toEqual(ok(3))
    expect(map(failure, (n: number) => n + 1)).toBe(failure)
  })

  it("mapErr transforms failure only", () => {
    const mapped = mapErr(failure, (e) => ({
      ...e,
      message: "wrapped",
    }))
    expect(isErr(mapped)).toBe(true)
    if (isErr(mapped)) {
      expect(mapped.error.message).toBe("wrapped")
    }
    expect(mapErr(ok(1), (e: never) => e)).toEqual(ok(1))
  })

  it("andThen chains on success", () => {
    expect(andThen(ok(2), (n) => ok(n * 2))).toEqual(ok(4))
    expect(andThen(ok(0), () => failure)).toEqual(failure)
    expect(andThen(failure, () => ok(99))).toEqual(failure)
  })

  it("unwrapOr returns value or fallback", () => {
    expect(unwrapOr(ok("x"), "y")).toBe("x")
    expect(unwrapOr(failure, "y")).toBe("y")
  })
})
