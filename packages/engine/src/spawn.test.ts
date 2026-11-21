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
import {
  GENERATED_TASK_ID_RE,
  type AgentTask,
  type Workflow,
} from "@workspace/shared"
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
  needs: [],
  spawn: true,
}

const baseGraph: Workflow = {
  id: "research",
  limits: { maxTasks: 10, maxSpawnDepth: 2 },
  tasks: [parent],
}

describe("processSpawnDir", () => {
  it("accepts a valid batch, assigns ids, and stamps promptDir", () => {
    const runRoot = tempDir()
    const attemptRoot = join(runRoot, "tasks", "plan", "attempt-1")
    const spawnDir = join(attemptRoot, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "fetch.yaml"),
      "kind: command\nrun: echo fetch\nneeds: [plan]\n"
    )
    writeFileSync(
      join(spawnDir, "merge.yaml"),
      "kind: command\nrun: echo merge\nneeds: [fetch]\n"
    )

    const { accepted, rejections } = processSpawnDir(
      parent,
      attemptRoot,
      runRoot,
      baseGraph,
      undefined
    )
    expect(rejections).toEqual([])
    expect(accepted).toHaveLength(2)
    expect(accepted[0]?.id).toMatch(GENERATED_TASK_ID_RE)
    expect(accepted[0]).toMatchObject({
      spawnDepth: 1,
      spawnedBy: "plan",
      promptDir: "tasks/plan/attempt-1/out/spawn/fetch",
    })
    expect(accepted[1]?.id).toMatch(GENERATED_TASK_ID_RE)
    expect(accepted[1]?.needs).toEqual([accepted[0]!.id])
  })

  it("rejects leftover id keys and schema errors", () => {
    const runRoot = tempDir()
    const attemptRoot = join(runRoot, "tasks", "plan", "attempt-1")
    const spawnDir = join(attemptRoot, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "dup.yaml"),
      "id: plan\nkind: command\nrun: echo x\n"
    )
    writeFileSync(join(spawnDir, "bad.yaml"), "kind: command\n")

    const { accepted, rejections } = processSpawnDir(
      parent,
      attemptRoot,
      runRoot,
      baseGraph,
      undefined
    )
    expect(accepted).toEqual([])
    expect(rejections.map((r) => r.file).sort()).toEqual([
      "bad.yaml",
      "dup.yaml",
    ])
    expect(rejections.find((r) => r.file === "dup.yaml")?.reason).toContain(
      "remove the id key"
    )
  })

  it("rejects when maxSpawnDepth would be exceeded", () => {
    const runRoot = tempDir()
    const attemptRoot = join(runRoot, "tasks", "plan", "attempt-1")
    const spawnDir = join(attemptRoot, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "x.yaml"),
      "kind: command\nrun: echo x\nneeds: [plan]\n"
    )
    const deepParent: AgentTask = { ...parent, spawnDepth: 2 }
    const { accepted, rejections } = processSpawnDir(
      deepParent,
      attemptRoot,
      runRoot,
      { ...baseGraph, limits: { maxSpawnDepth: 2 } },
      undefined
    )
    expect(accepted).toEqual([])
    expect(rejections[0]?.reason).toContain("maxSpawnDepth")
  })

  it("rejects leftover instructions on a spawn spec", () => {
    const runRoot = tempDir()
    const attemptRoot = join(runRoot, "tasks", "plan", "attempt-1")
    const spawnDir = join(attemptRoot, "out", "spawn")
    mkdirSync(spawnDir, { recursive: true })
    writeFileSync(
      join(spawnDir, "child.yaml"),
      "kind: agent\ncli: claude\ninstructions: tasks/x.md\n"
    )
    const { accepted, rejections } = processSpawnDir(
      parent,
      attemptRoot,
      runRoot,
      baseGraph,
      undefined
    )
    expect(accepted).toEqual([])
    expect(rejections[0]?.reason).toContain("instructions")
  })

  it("writes rejection feedback for the next input", () => {
    const runRoot = tempDir()
    writeSpawnRejections(runRoot, "plan", [
      { file: "x.yaml", reason: "duplicate stem x" },
    ])
    const text = readFileSync(
      join(runRoot, "tasks", "plan", "input", "spawn-rejections.md"),
      "utf8"
    )
    expect(text).toContain("x.yaml")
    expect(text).toContain("duplicate stem x")
  })
})
