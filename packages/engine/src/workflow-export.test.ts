import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  copyWorkflowExport,
  isWorkflowExportOmitted,
} from "./workflow-export.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("workflow export copy", () => {
  it("omits runs and .cache top-level names", () => {
    expect(isWorkflowExportOmitted("runs")).toBe(true)
    expect(isWorkflowExportOmitted(".cache")).toBe(true)
    expect(isWorkflowExportOmitted("memory")).toBe(false)
    expect(isWorkflowExportOmitted("workflow.yaml")).toBe(false)
  })

  it("copies a workflow tree without runs or .cache", () => {
    const root = mkdtempSync(join(tmpdir(), "flowapp-export-"))
    dirs.push(root)
    const src = join(root, "src")
    const dest = join(root, "dest")
    mkdirSync(join(src, "memory"), { recursive: true })
    mkdirSync(join(src, "runs", "r1"), { recursive: true })
    mkdirSync(join(src, ".cache", "npm"), { recursive: true })
    writeFileSync(join(src, "workflow.yaml"), "id: demo\n")
    writeFileSync(join(src, "memory", "note.md"), "hi\n")
    writeFileSync(join(src, "runs", "r1", "graph.json"), "{}\n")
    writeFileSync(join(src, ".cache", "npm", "x"), "c\n")

    copyWorkflowExport(src, dest)

    expect(readFileSync(join(dest, "workflow.yaml"), "utf8")).toBe("id: demo\n")
    expect(readFileSync(join(dest, "memory", "note.md"), "utf8")).toBe("hi\n")
    expect(existsSync(join(dest, "runs"))).toBe(false)
    expect(existsSync(join(dest, ".cache"))).toBe(false)
  })
})
