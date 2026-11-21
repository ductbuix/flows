import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  moveRemovedTasksToTrash,
  orphanTaskFolderIds,
  trashStamp,
  uniqueTrashDir,
} from "./task-trash.ts"

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

describe("task trash helpers", () => {
  it("formats a UTC stamp without separators", () => {
    expect(trashStamp(new Date("2026-11-21T13:15:00.123Z"))).toBe(
      "20261121T131500Z"
    )
  })

  it("appends a numeric suffix when the trash name exists", () => {
    const root = tmpRoot()
    const tasks = join(root, "tasks")
    mkdirSync(join(tasks, ".trash", "gone-20261121T131500Z"), {
      recursive: true,
    })
    const first = uniqueTrashDir(tasks, "gone", "20261121T131500Z")
    expect(first).toBe(join(tasks, ".trash", "gone-20261121T131500Z-1"))
    mkdirSync(first)
    const second = uniqueTrashDir(tasks, "gone", "20261121T131500Z")
    expect(second).toBe(join(tasks, ".trash", "gone-20261121T131500Z-2"))
  })

  it("moves a task folder and leftover need files", () => {
    const root = tmpRoot()
    const tasks = join(root, "tasks")
    mkdirSync(join(tasks, "gone"), { recursive: true })
    writeFileSync(join(tasks, "gone", "prompt.md"), "bye")
    mkdirSync(join(tasks, "keep"), { recursive: true })
    writeFileSync(join(tasks, "keep", "need-gone.md"), "judge")
    writeFileSync(join(tasks, "keep", "when.md"), "stay")

    const fail = moveRemovedTasksToTrash(root, ["gone"], "20261121T131500Z")
    expect(fail).toBeNull()
    expect(existsSync(join(tasks, "gone"))).toBe(false)
    const dest = join(tasks, ".trash", "gone-20261121T131500Z")
    expect(existsSync(join(dest, "prompt.md"))).toBe(true)
    expect(existsSync(join(dest, "from", "keep", "need-gone.md"))).toBe(true)
    expect(existsSync(join(tasks, "keep", "when.md"))).toBe(true)
    expect(existsSync(join(tasks, "keep", "need-gone.md"))).toBe(false)
  })

  it("skips a missing folder and still collects need files", () => {
    const root = tmpRoot()
    const tasks = join(root, "tasks")
    mkdirSync(join(tasks, "keep"), { recursive: true })
    writeFileSync(join(tasks, "keep", "need-gone.md"), "judge")

    expect(
      moveRemovedTasksToTrash(root, ["gone"], "20261121T000000Z")
    ).toBeNull()
    expect(
      existsSync(
        join(
          tasks,
          ".trash",
          "gone-20261121T000000Z",
          "from",
          "keep",
          "need-gone.md"
        )
      )
    ).toBe(true)
  })

  it("skips when there is nothing to move", () => {
    const root = tmpRoot()
    mkdirSync(join(root, "tasks"), { recursive: true })
    expect(moveRemovedTasksToTrash(root, ["gone"])).toBeNull()
    expect(existsSync(join(root, "tasks", ".trash"))).toBe(false)
  })

  it("lists orphan task folders for retry", () => {
    const root = tmpRoot()
    const tasks = join(root, "tasks")
    mkdirSync(join(tasks, "keep"), { recursive: true })
    mkdirSync(join(tasks, "orphan"), { recursive: true })
    mkdirSync(join(tasks, ".trash", "old"), { recursive: true })
    expect(orphanTaskFolderIds(tasks, new Set(["keep"]))).toEqual(["orphan"])
  })

  it("returns a path when .trash cannot be created", () => {
    const root = tmpRoot()
    const tasks = join(root, "tasks")
    mkdirSync(tasks, { recursive: true })
    writeFileSync(join(tasks, ".trash"), "blocked")
    mkdirSync(join(tasks, "gone"), { recursive: true })
    writeFileSync(join(tasks, "gone", "prompt.md"), "x")

    const fail = moveRemovedTasksToTrash(root, ["gone"], "stamp")
    expect(fail?.path).toMatch(/^tasks\/\.trash\/gone-stamp/)
  })
})
