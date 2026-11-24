import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHost } from "@workspace/adapters-node"
import { afterEach, describe, expect, it } from "vitest"
import {
  readNodeWorkflowDetail,
  writeNodeWorkflowYaml,
} from "./node-workflow-files.ts"
import { createWorkflow } from "./workflow-lifecycle.ts"
import { listWorkflowSummaries } from "./workflows-fs.ts"

const nodeYaml = `id: nf
nodes:
  - id: a
    kind: trigger
    type: manual
  - id: b
    kind: agent
    cli: claude
edges:
  - { from: a, to: b }
`

const homes: string[] = []

afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

function stack(yaml = nodeYaml) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-nodes-"))
  homes.push(home)
  const engine = createHost({ home })
  const dir = join(home, "workflows", "nf")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { dir, engine, home }
}

describe("node workflow files", () => {
  it("reads a node workflow and creates node files on write", () => {
    const { dir, engine } = stack()
    const d = readNodeWorkflowDetail(engine, "nf")!
    expect(d.workflow?.nodes).toHaveLength(2)
    const res = writeNodeWorkflowYaml(engine, "nf", nodeYaml, d.hash)
    expect(res.ok).toBe(true)
    expect(readFileSync(join(dir, "nodes", "b", "prompt.md"), "utf8")).toBe("")
    expect(existsSync(join(dir, "nodes", "a"))).toBe(false)
    engine.close()
  })

  it("keeps existing node files", () => {
    const { dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "keep me")
    const d = readNodeWorkflowDetail(engine, "nf")!
    writeNodeWorkflowYaml(engine, "nf", nodeYaml, d.hash)
    expect(readFileSync(join(dir, "nodes", "b", "prompt.md"), "utf8")).toBe(
      "keep me"
    )
    engine.close()
  })

  it("moves a removed node folder to nodes/.trash", () => {
    const { dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "p")
    const d = readNodeWorkflowDetail(engine, "nf")!
    const next = `id: nf
nodes:
  - id: a
    kind: trigger
    type: manual
`
    const res = writeNodeWorkflowYaml(engine, "nf", next, d.hash)
    expect(res.ok).toBe(true)
    expect(existsSync(join(dir, "nodes", "b"))).toBe(false)
    const trash = readdirSync(join(dir, "nodes", ".trash"))
    expect(trash).toHaveLength(1)
    expect(trash[0]).toMatch(/^b-\d{8}T\d{6}Z$/)
    expect(
      readFileSync(join(dir, "nodes", ".trash", trash[0]!, "prompt.md"), "utf8")
    ).toBe("p")
    engine.close()
  })

  it("moves the folder on rename", () => {
    const { dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "p")
    const d = readNodeWorkflowDetail(engine, "nf")!
    const renamed = nodeYaml.replace("id: b", "id: z").replace("to: b", "to: z")
    const res = writeNodeWorkflowYaml(engine, "nf", renamed, d.hash, [
      { from: "b", to: "z" },
    ])
    expect(res.ok).toBe(true)
    expect(existsSync(join(dir, "nodes", "b"))).toBe(false)
    expect(readFileSync(join(dir, "nodes", "z", "prompt.md"), "utf8")).toBe("p")
    expect(existsSync(join(dir, "nodes", ".trash"))).toBe(false)
    engine.close()
  })

  it("returns conflict with disk content on a stale baseHash", () => {
    const { engine } = stack()
    const res = writeNodeWorkflowYaml(engine, "nf", nodeYaml, "stale")
    expect(res.ok).toBe(false)
    if (res.ok === false) {
      expect(res.kind).toBe("conflict")
      if (res.kind === "conflict") {
        expect(res.diskYaml).toBe(nodeYaml)
      }
    }
    engine.close()
  })

  it("returns a validation error for a file with old keys", () => {
    const old = `id: nf
tasks:
  - id: a
    kind: command
    run: echo
`
    const { dir, engine } = stack(old)
    const d = readNodeWorkflowDetail(engine, "nf")!
    expect(d.workflow).toBeNull()
    expect(d.errors[0]?.message).toContain('old workflow format: key "tasks"')
    const res = writeNodeWorkflowYaml(engine, "nf", old, d.hash)
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.kind).toBe("invalid")
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(old)
    engine.close()
  })

  it("rejects an invalid node file without writing", () => {
    const { dir, engine } = stack()
    const d = readNodeWorkflowDetail(engine, "nf")!
    const bad = nodeYaml.replace("cli: claude", "cli: nope")
    const res = writeNodeWorkflowYaml(engine, "nf", bad, d.hash)
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.kind).toBe("invalid")
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(nodeYaml)
    engine.close()
  })

  it("lists node workflows and an old-format file with its error", () => {
    const { engine, home } = stack()
    const old = join(home, "workflows", "old")
    mkdirSync(old, { recursive: true })
    writeFileSync(
      join(old, "workflow.yaml"),
      "id: old\ntasks:\n  - id: a\n    kind: command\n    run: x\n"
    )
    const list = listWorkflowSummaries(engine)
    expect(list).toEqual([
      { id: "nf", taskCount: 2 },
      { id: "old", taskCount: 0 },
    ])
    const detail = readNodeWorkflowDetail(engine, "old")!
    expect(detail.workflow).toBeNull()
    expect(detail.errors[0]?.message).toContain('key "tasks"')
    engine.close()
  })

  it("creates a node workflow with a Trigger", () => {
    const { engine, home } = stack()
    const res = createWorkflow(engine, "fresh", "g")
    expect(res.ok).toBe(true)
    const yaml = readFileSync(
      join(home, "workflows", "fresh", "workflow.yaml"),
      "utf8"
    )
    expect(yaml).toContain("kind: trigger")
    const detail = readNodeWorkflowDetail(engine, "fresh")!
    expect(detail.errors).toEqual([])
    engine.close()
  })
})
