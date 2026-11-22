import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEngine } from "@workspace/engine"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "./app.ts"
import { hashContent } from "./hash.ts"

const yaml = `id: nf
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

function stack() {
  process.env.FLOWS_NODES = "1"
  const home = mkdtempSync(join(tmpdir(), "flowapp-layout-"))
  homes.push(home)
  const engine = createEngine({ home })
  const dir = join(home, "workflows", "nf")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "workflow.yaml"), yaml)
  return { app: createApp({ engine }), dir, engine }
}

const putLayout = (app: ReturnType<typeof stack>["app"], body: unknown) =>
  app.request("/api/workflows/nf/layout", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("layout file endpoint", () => {
  it("reads a missing file as empty", async () => {
    const { app, engine } = stack()
    const res = await app.request("/api/workflows/nf/layout")
    expect(await res.json()).toEqual({ version: 1, nodes: {} })
    engine.close()
  })

  it("round trips, drops orphans and leaves the YAML hash alone", async () => {
    const { app, dir, engine } = stack()
    const before = hashContent(readFileSync(join(dir, "workflow.yaml"), "utf8"))
    const res = await putLayout(app, {
      version: 1,
      nodes: { a: { x: 1, y: 2 }, ghost: { x: 9, y: 9 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    expect(res.status).toBe(200)
    const got = await (await app.request("/api/workflows/nf/layout")).json()
    expect(got).toEqual({
      version: 1,
      nodes: { a: { x: 1, y: 2 } },
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    expect(hashContent(readFileSync(join(dir, "workflow.yaml"), "utf8"))).toBe(before)
    engine.close()
  })

  it("moves the entry on a node rename", async () => {
    const { app, engine } = stack()
    await putLayout(app, { version: 1, nodes: { b: { x: 5, y: 6 } } })
    const d = (await (await app.request("/api/workflows/nf")).json()) as { hash: string }
    const renamed = yaml.replace(/id: b/, "id: c").replace("to: b", "to: c")
    const res = await app.request("/api/workflows/nf", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        yaml: renamed,
        baseHash: d.hash,
        renames: [{ from: "b", to: "c" }],
      }),
    })
    expect(res.status).toBe(200)
    const got = (await (await app.request("/api/workflows/nf/layout")).json()) as { nodes: unknown }
    expect(got.nodes).toEqual({ c: { x: 5, y: 6 } })
    engine.close()
  })

  it("404s for a missing workflow", async () => {
    const { app, engine } = stack()
    const res = await app.request("/api/workflows/nope/layout")
    expect(res.status).toBe(404)
    engine.close()
  })
})
