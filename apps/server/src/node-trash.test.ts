import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  orphanNodeFolderIds,
  trashStamp,
  uniqueTrashDir,
} from "./node-trash.ts"

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "flowapp-trash-"))
  roots.push(root)
  return root
}

describe("node trash helpers", () => {
  it("formats a UTC stamp without separators", () => {
    expect(trashStamp(new Date("2026-11-21T13:15:00.123Z"))).toBe(
      "20261121T131500Z"
    )
  })

  it("appends a numeric suffix when the trash name exists", () => {
    const root = tmpRoot()
    const tasks = join(root, "nodes")
    mkdirSync(join(tasks, ".trash", "gone-20261121T131500Z"), {
      recursive: true,
    })
    const first = uniqueTrashDir(tasks, "gone", "20261121T131500Z")
    expect(first).toBe(join(tasks, ".trash", "gone-20261121T131500Z-1"))
    mkdirSync(first)
    const second = uniqueTrashDir(tasks, "gone", "20261121T131500Z")
    expect(second).toBe(join(tasks, ".trash", "gone-20261121T131500Z-2"))
  })

  it("lists orphan node folders", () => {
    const root = tmpRoot()
    const tasks = join(root, "nodes")
    mkdirSync(join(tasks, "keep"), { recursive: true })
    mkdirSync(join(tasks, "orphan"), { recursive: true })
    mkdirSync(join(tasks, ".trash", "old"), { recursive: true })
    expect(orphanNodeFolderIds(tasks, new Set(["keep"]))).toEqual(["orphan"])
  })
})
