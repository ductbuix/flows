import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  conditionIsSlow,
  evaluateCondition,
  evaluateExpr,
} from "./conditions.ts"

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
  it("matches exit equals and sets", async () => {
    expect(await evaluateCondition({ exit: 0 }, { exitCode: 0 })).toBe(true)
    expect(await evaluateCondition({ exit: 0 }, { exitCode: 1 })).toBe(false)
    expect(await evaluateCondition({ exit: [0, 2] }, { exitCode: 2 })).toBe(
      true
    )
  })

  it("matches exit against every need exit code", async () => {
    expect(
      await evaluateCondition({ exit: 0 }, { needExitCodes: { a: 0, b: 0 } })
    ).toBe(true)
    expect(
      await evaluateCondition({ exit: 0 }, { needExitCodes: { a: 0, b: 1 } })
    ).toBe(false)
  })

  it("combines with all and any", async () => {
    expect(
      await evaluateCondition(
        { all: [{ exit: 0 }, { exit: [0, 1] }] },
        { exitCode: 0 }
      )
    ).toBe(true)
    expect(
      await evaluateCondition(
        { any: [{ exit: 1 }, { exit: 0 }] },
        { exitCode: 0 }
      )
    ).toBe(true)
    expect(
      await evaluateCondition(
        { all: [{ exit: 0 }, { exit: 1 }] },
        { exitCode: 0 }
      )
    ).toBe(false)
  })

  it("evaluates expr over json and text outputs", async () => {
    const root = tempAttempt()
    writeFileSync(join(root, "out", "score.json"), '{"score":0.9}')
    writeFileSync(join(root, "out", "ok.txt"), "yes")
    expect(
      await evaluateCondition(
        { expr: "json('out/score.json').score >= 0.8" },
        { attemptRoot: root }
      )
    ).toBe(true)
    expect(
      await evaluateCondition(
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

  it("marks agent leaves and groups containing them as slow", () => {
    expect(
      conditionIsSlow({
        agent: { cli: "claude", instructions: "j.md" },
      })
    ).toBe(true)
    expect(
      conditionIsSlow({
        all: [
          { exit: 0 },
          { agent: { cli: "cursor", instructions: "j.md" } },
        ],
      })
    ).toBe(true)
    expect(conditionIsSlow({ all: [{ exit: 0 }, { expr: "true" }] })).toBe(
      false
    )
  })
})
