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
import { createEngine } from "@workspace/engine"
import { nodeWorkflowDetailSchema } from "@workspace/shared"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"

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
  delete process.env.FLOWS_NODES
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true })
})

function stack(yaml = nodeYaml) {
  const home = mkdtempSync(join(tmpdir(), "flowapp-nodes-"))
  homes.push(home)
  const engine = createEngine({ home })
  const app = createApp({ engine })
  const dir = join(home, "workflows", "nf")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { app, dir, engine }
}

const get = async (app: ReturnType<typeof stack>["app"]) =>
  nodeWorkflowDetailSchema.parse(
    await (await app.request("/api/workflows/nf")).json()
  )

const put = (
  app: ReturnType<typeof stack>["app"],
  yaml: string,
  baseHash: string,
  renames?: { from: string; to: string }[]
) =>
  app.request("/api/workflows/nf", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ yaml, baseHash, renames }),
  })

describe("node workflow files (FLOWS_NODES)", () => {
  it("reads a node workflow and creates node files on PUT", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, dir, engine } = stack()
    const d = await get(app)
    expect(d.workflow?.nodes).toHaveLength(2)
    const res = await put(app, nodeYaml, d.hash)
    expect(res.status).toBe(200)
    expect(readFileSync(join(dir, "nodes", "b", "prompt.md"), "utf8")).toBe("")
    expect(existsSync(join(dir, "nodes", "a"))).toBe(false)
    engine.close()
  })

  it("keeps existing node files", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "keep me")
    const d = await get(app)
    await put(app, nodeYaml, d.hash)
    expect(readFileSync(join(dir, "nodes", "b", "prompt.md"), "utf8")).toBe(
      "keep me"
    )
    engine.close()
  })

  it("moves a removed node folder to nodes/.trash", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "p")
    const d = await get(app)
    const next = `id: nf
nodes:
  - id: a
    kind: trigger
    type: manual
`
    const res = await put(app, next, d.hash)
    expect(res.status).toBe(200)
    expect(existsSync(join(dir, "nodes", "b"))).toBe(false)
    const trash = readdirSync(join(dir, "nodes", ".trash"))
    expect(trash).toHaveLength(1)
    expect(trash[0]).toMatch(/^b-\d{8}T\d{6}Z$/)
    expect(
      readFileSync(join(dir, "nodes", ".trash", trash[0]!, "prompt.md"), "utf8")
    ).toBe("p")
    engine.close()
  })

  it("moves the folder on rename", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, dir, engine } = stack()
    mkdirSync(join(dir, "nodes", "b"), { recursive: true })
    writeFileSync(join(dir, "nodes", "b", "prompt.md"), "p")
    const d = await get(app)
    const renamed = nodeYaml
      .replace("id: b", "id: z")
      .replace("to: b", "to: z")
    const res = await put(app, renamed, d.hash, [{ from: "b", to: "z" }])
    expect(res.status).toBe(200)
    expect(existsSync(join(dir, "nodes", "b"))).toBe(false)
    expect(readFileSync(join(dir, "nodes", "z", "prompt.md"), "utf8")).toBe("p")
    expect(existsSync(join(dir, "nodes", ".trash"))).toBe(false)
    engine.close()
  })

  it("returns 409 with disk content on a stale baseHash", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, engine } = stack()
    const res = await put(app, nodeYaml, "stale")
    expect(res.status).toBe(409)
    const body = (await res.json()) as { message: string; diskYaml: string }
    expect(body.message).toBe("conflict")
    expect(body.diskYaml).toBe(nodeYaml)
    engine.close()
  })

  it("returns a validation error for a file with old keys", async () => {
    process.env.FLOWS_NODES = "1"
    const old = `id: nf
tasks:
  - id: a
    kind: command
    run: echo
`
    const { app, dir, engine } = stack(old)
    const d = await get(app)
    expect(d.workflow).toBeNull()
    expect(d.errors[0]?.message).toContain('old workflow format: key "tasks"')
    const res = await put(app, old, d.hash)
    expect(res.status).toBe(400)
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(old)
    engine.close()
  })

  it("rejects an invalid node file without writing", async () => {
    process.env.FLOWS_NODES = "1"
    const { app, dir, engine } = stack()
    const d = await get(app)
    const bad = nodeYaml.replace("cli: claude", "cli: nope")
    const res = await put(app, bad, d.hash)
    expect(res.status).toBe(400)
    expect(readFileSync(join(dir, "workflow.yaml"), "utf8")).toBe(nodeYaml)
    engine.close()
  })

  it("leaves the task schema in place when the flag is off", async () => {
    const { app, engine } = stack()
    const body = (await (await app.request("/api/workflows/nf")).json()) as {
      workflow: unknown
      errors: unknown[]
    }
    // Task schema: a node file is not a valid task workflow.
    expect(body.workflow).toBeNull()
    expect(body.errors.length).toBeGreaterThan(0)
    engine.close()
  })
})
