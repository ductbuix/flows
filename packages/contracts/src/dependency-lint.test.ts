import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { ESLint } from "eslint"
import {
  adaptersRestrictedImports,
  contractsRestrictedImports,
  coreRestrictedImports,
  noCycleBlock,
  webRestrictedImports,
} from "../../../eslint-dependency-guards.mjs"

const scratchDirs: string[] = []

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "dep-lint-"))
  scratchDirs.push(dir)
  return dir
}

async function lintCode(
  code: string,
  // eslint flat RulesConfig is stricter than our exported rule objects
  rules: object,
  filename = "scratch.ts"
): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
        rules: rules as never,
      },
    ],
  })
  return eslint.lintText(code, { filePath: filename })
}

function messages(results: ESLint.LintResult[]): string[] {
  return results.flatMap((r) => r.messages.map((m) => m.message))
}

describe("DES-042 dependency lint guards", () => {
  it("contracts: rejects a workspace import in a scratch file", async () => {
    const results = await lintCode(
      'import { x } from "@workspace/core"\n',
      contractsRestrictedImports
    )
    expect(messages(results).join("\n")).toMatch(/contracts must not import/)
  })

  it("contracts: allows zod", async () => {
    const results = await lintCode(
      'import { z } from "zod"\nexport const n = z.number()\n',
      contractsRestrictedImports
    )
    expect(messages(results)).toEqual([])
  })

  it("core: rejects node:fs in a scratch file", async () => {
    const results = await lintCode(
      'import { readFileSync } from "node:fs"\n',
      coreRestrictedImports
    )
    expect(messages(results).join("\n")).toMatch(/core must not import/)
  })

  it("adapters: rejects another adapter import in a scratch file", async () => {
    const results = await lintCode(
      'import { x } from "@workspace/agent-acp"\n',
      adaptersRestrictedImports
    )
    expect(messages(results).join("\n")).toMatch(
      /adapters must not import other adapters/
    )
  })

  it("adapters: allows @workspace/core", async () => {
    const results = await lintCode(
      'import { x } from "@workspace/core"\n',
      adaptersRestrictedImports
    )
    expect(messages(results)).toEqual([])
  })

  it("web: rejects core, engine and adapters imports in a scratch file", async () => {
    for (const spec of [
      "@workspace/core",
      "@workspace/engine",
      "@workspace/adapters-node",
    ]) {
      const results = await lintCode(
        `import { x } from "${spec}"\n`,
        webRestrictedImports
      )
      expect(messages(results).join("\n")).toMatch(
        /web must not import core, engine or adapters/
      )
    }
  })

  it("import/no-cycle: deliberate cycle in scratch files fails", async () => {
    const dir = scratchDir()
    writeFileSync(join(dir, "a.ts"), 'import "./b.ts"\nexport const a = 1\n')
    writeFileSync(join(dir, "b.ts"), 'import "./a.ts"\nexport const b = 1\n')

    const eslint = new ESLint({
      cwd: dir,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.ts"],
          languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
          },
          plugins: noCycleBlock.plugins as never,
          settings: noCycleBlock.settings,
          rules: noCycleBlock.rules as never,
        },
      ],
    })
    const results = await eslint.lintFiles(["a.ts", "b.ts"])
    expect(messages(results).join("\n")).toMatch(/Dependency cycle detected/)
  })
})
