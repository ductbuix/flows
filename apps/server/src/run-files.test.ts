import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { listOutFiles, readOutTextFile, resolveOutPath } from "./run-files.ts"

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe("out file helpers", () => {
  it("lists and reads files under out/, and rejects escapes", () => {
    const root = mkdtempSync(join(tmpdir(), "flowapp-out-"))
    temps.push(root)
    const out = join(root, "out")
    mkdirSync(join(out, "nested"), { recursive: true })
    writeFileSync(join(out, "top.txt"), "top\n")
    writeFileSync(join(out, "nested", "deep.md"), "# deep\n")
    writeFileSync(join(root, "SUMMARY.md"), "# summary\n")

    expect(listOutFiles(root).files).toEqual([
      { path: "nested", type: "dir" },
      { path: "nested/deep.md", type: "file" },
      { path: "top.txt", type: "file" },
    ])
    expect(readOutTextFile(root, "nested/deep.md")).toEqual({
      path: "nested/deep.md",
      content: "# deep\n",
    })
    expect(resolveOutPath(root, "../SUMMARY.md")).toBeNull()
    expect(readOutTextFile(root, "../SUMMARY.md")).toBeNull()
    expect(readOutTextFile(root, "missing.txt")).toBeNull()
  })
})
