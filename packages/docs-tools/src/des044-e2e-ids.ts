// Assert DES-044 test ids exist in apps/e2e (BL-216). Prevents checklist drift.
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

const ROW =
  /^\|\s*[A-Z]{2}-\d+\s*\|[^|]+\|\s*(app|partial|missing|drop)\s*\|\s*`?([^`|]*)`?\s*\|/

/** Checklist rows that need a matching Playwright `test("…")` title. */
export function requiredDes044TestIds(
  markdown: string
): { status: "app" | "drop"; testId: string }[] {
  const out: { status: "app" | "drop"; testId: string }[] = []
  for (const line of markdown.split("\n")) {
    const m = line.match(ROW)
    if (!m) continue
    const status = m[1] as "app" | "partial" | "missing" | "drop"
    const testId = m[2]!.trim()
    if (status !== "app" && status !== "drop") continue
    if (!testId || testId === "—") continue
    out.push({ status, testId })
  }
  return out
}

/** Collect `test("title")` / `test('title')` titles per `*.spec.ts` basename. */
export function collectE2eTitles(testsDir: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const name of readdirSync(testsDir)) {
    if (!name.endsWith(".spec.ts")) continue
    const text = readFileSync(join(testsDir, name), "utf8")
    const titles = new Set<string>()
    for (const m of text.matchAll(
      /\btest\(\s*(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\1/g
    )) {
      titles.add(m[2]!.replace(/\\(['"])/g, "$1"))
    }
    map.set(name, titles)
  }
  return map
}

export function missingDes044TestIds(
  markdown: string,
  testsDir: string
): string[] {
  const titles = collectE2eTitles(testsDir)
  const missing: string[] = []
  for (const { testId } of requiredDes044TestIds(markdown)) {
    const sep = " › "
    const i = testId.indexOf(sep)
    if (i < 0) {
      missing.push(`${testId} (bad format)`)
      continue
    }
    const file = testId.slice(0, i)
    const title = testId.slice(i + sep.length)
    if (!titles.get(file)?.has(title)) {
      missing.push(testId)
    }
  }
  return missing
}

export function checkDes044AgainstRepo(
  root = ROOT
): { ok: true } | { ok: false; missing: string[] } {
  const markdown = readFileSync(
    join(root, "docs/designs/des-044-mock-parity-checklist.md"),
    "utf8"
  )
  const missing = missingDes044TestIds(markdown, join(root, "apps/e2e/tests"))
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
