import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { evaluateCondition, evaluateExpr } from "./conditions.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempAttempt(): string {
  const root = mkdtempSync(join(tmpdir(), "flow-cond-"))
  dirs.push(root)
  mkdirSync(join(root, "out"), { recursive: true })
  return root
}

describe("evaluateCondition", () => {
  it("matches exit equals and sets", () => {
    expect(evaluateCondition({ exit: 0 }, { exitCode: 0 })).toBe(true)
    expect(evaluateCondition({ exit: 0 }, { exitCode: 1 })).toBe(false)
    expect(evaluateCondition({ exit: [0, 2] }, { exitCode: 2 })).toBe(true)
  })

  it("matches exit against every need exit code", () => {
    expect(
      evaluateCondition({ exit: 0 }, { needExitCodes: { a: 0, b: 0 } })
    ).toBe(true)
    expect(
      evaluateCondition({ exit: 0 }, { needExitCodes: { a: 0, b: 1 } })
    ).toBe(false)
  })

  it("combines with all and any", () => {
    expect(
      evaluateCondition(
        { all: [{ exit: 0 }, { exit: [0, 1] }] },
        { exitCode: 0 }
      )
    ).toBe(true)
    expect(
      evaluateCondition({ any: [{ exit: 1 }, { exit: 0 }] }, { exitCode: 0 })
    ).toBe(true)
    expect(
      evaluateCondition({ all: [{ exit: 0 }, { exit: 1 }] }, { exitCode: 0 })
    ).toBe(false)
  })

  it("evaluates expr over json and text outputs", () => {
    const root = tempAttempt()
    writeFileSync(join(root, "out", "score.json"), '{"score":0.9}')
    writeFileSync(join(root, "out", "ok.txt"), "yes")
    expect(
      evaluateCondition(
        { expr: "json('out/score.json').score >= 0.8" },
        { attemptRoot: root }
      )
    ).toBe(true)
    expect(
      evaluateCondition(
        {
          all: [
            { expr: "json('out/score.json').score >= 0.8" },
            { expr: "text('out/ok.txt') == 'yes'" },
          ],
        },
        { attemptRoot: root }
      )
    ).toBe(true)
    expect(evaluateExpr("text('out/ok.txt') != 'no'", root)).toBe(true)
  })
})
