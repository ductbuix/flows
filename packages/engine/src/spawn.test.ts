import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { AgentTask, Workflow } from "@workspace/shared"
import { processSpawnDir, writeSpawnRejections } from "./spawn.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "flowapp-spawn-"))
  dirs.push(dir)
  return dir
}

const parent: AgentTask = {
  id: "plan",
  kind: "agent",
  cli: "claude",
  instructions: "tasks/plan.md",
  needs: [],
  spawn: true,
}

const baseGraph: Workflow = {
  id: "research",
  limits: { maxTasks: 10, maxSpawnDepth: 2 },
  tasks: [parent],
}

describe("processSpawnDir", () => {
  it("accepts a valid batch and stamps spawnDepth", () => {
    const root = tempDir()
    const spawnDir = join(root, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "fetch.yaml"),
      "id: fetch\nkind: command\nrun: echo fetch\nneeds: [plan]\n"
    )
    writeFileSync(
      join(spawnDir, "merge.yaml"),
      "id: merge\nkind: command\nrun: echo merge\nneeds: [fetch]\n"
    )

    const { accepted, rejections } = processSpawnDir(
      parent,
      root,
      baseGraph,
      undefined
    )
    expect(rejections).toEqual([])
    expect(accepted).toHaveLength(2)
    expect(accepted[0]).toMatchObject({
      id: "fetch",
      spawnDepth: 1,
      spawnedBy: "plan",
    })
    expect(accepted[1]?.id).toBe("merge")
  })

  it("rejects duplicate ids and schema errors", () => {
    const root = tempDir()
    const spawnDir = join(root, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "dup.yaml"),
      "id: plan\nkind: command\nrun: echo x\n"
    )
    writeFileSync(join(spawnDir, "bad.yaml"), "id: bad\nkind: command\n")

    const { accepted, rejections } = processSpawnDir(
      parent,
      root,
      baseGraph,
      undefined
    )
    expect(accepted).toEqual([])
    expect(rejections.map((r) => r.file).sort()).toEqual([
      "bad.yaml",
      "dup.yaml",
    ])
  })

  it("rejects when maxSpawnDepth would be exceeded", () => {
    const root = tempDir()
    const spawnDir = join(root, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "x.yaml"),
      "id: x\nkind: command\nrun: echo x\nneeds: [plan]\n"
    )
    const deepParent: AgentTask = { ...parent, spawnDepth: 2 }
    const { accepted, rejections } = processSpawnDir(
      deepParent,
      root,
      { ...baseGraph, limits: { maxSpawnDepth: 2 } },
      undefined
    )
    expect(accepted).toEqual([])
    expect(rejections[0]?.reason).toContain("maxSpawnDepth")
  })

  it("writes rejection feedback for the next input", () => {
    const runRoot = tempDir()
    writeSpawnRejections(runRoot, "plan", [
      { file: "x.yaml", reason: "duplicate task id x" },
    ])
    const text = readFileSync(
      join(runRoot, "tasks", "plan", "input", "spawn-rejections.md"),
      "utf8"
    )
    expect(text).toContain("x.yaml")
    expect(text).toContain("duplicate task id x")
  })
})
