import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  checkDes044AgainstRepo,
  missingDes044TestIds,
  requiredDes044TestIds,
} from "./des044-e2e-ids.ts"

describe("DES-044 e2e id checker (BL-216)", () => {
  it("parses app and drop rows with a test id", () => {
    const md = `
| id | item | status | test id | backlog |
| XX-01 | x | app | \`a.spec.ts › hello\` | — |
| XX-02 | y | drop | \`a.spec.ts › gone\` | — |
| XX-03 | z | partial | \`a.spec.ts › later\` | — |
| XX-04 | w | drop | — | — |
`
    expect(requiredDes044TestIds(md)).toEqual([
      { status: "app", testId: "a.spec.ts › hello" },
      { status: "drop", testId: "a.spec.ts › gone" },
    ])
  })

  it("reports missing titles", () => {
    const dir = mkdtempSync(join(tmpdir(), "des044-e2e-"))
    writeFileSync(
      join(dir, "a.spec.ts"),
      `import { test } from "@playwright/test"\ntest("hello", async () => {})\n`
    )
    const md = `
| id | item | status | test id | backlog |
| XX-01 | x | app | \`a.spec.ts › hello\` | — |
| XX-02 | y | app | \`a.spec.ts › missing\` | — |
`
    expect(missingDes044TestIds(md, dir)).toEqual(["a.spec.ts › missing"])
  })

  it("passes against the real repo checklist", () => {
    const result = checkDes044AgainstRepo()
    if (!result.ok) {
      expect.fail(
        `missing DES-044 e2e ids:\n${result.missing.map((m) => `  ${m}`).join("\n")}`
      )
    }
  })

  it("accepts template-literal-free double quotes only in fixtures", () => {
    const dir = mkdtempSync(join(tmpdir(), "des044-e2e-"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "x.spec.ts"),
      `test('single', async () => {})\ntest("double", async () => {})\n`
    )
    expect(
      missingDes044TestIds(
        "| XX-01 | x | app | `x.spec.ts › single` | — |\n| XX-02 | y | app | `x.spec.ts › double` | — |\n",
        dir
      )
    ).toEqual([])
  })
})
