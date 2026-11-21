import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createEngine } from "@workspace/engine"
import { createApp } from "./app.ts"

const homes: string[] = []
const prevCursor = process.env.FLOWAPP_CURSOR_PROJECTS

afterEach(() => {
  if (prevCursor === undefined) delete process.env.FLOWAPP_CURSOR_PROJECTS
  else process.env.FLOWAPP_CURSOR_PROJECTS = prevCursor
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function setup() {
  const home = mkdtempSync(join(tmpdir(), "flowapp-srv-trust-"))
  homes.push(home)
  process.env.FLOWAPP_CURSOR_PROJECTS = join(home, ".cursor-projects")
  const wf = join(home, "workflows", "agent-hi")
  mkdirSync(join(wf, "tasks", "a"), { recursive: true })
  writeFileSync(join(wf, "tasks", "a", "prompt.md"), "hi\n")
  writeFileSync(
    join(wf, "workflow.yaml"),
    `
id: agent-hi
tasks:
  - id: a
    kind: agent
    cli: claude
`
  )
  const engine = createEngine({ home })
  const app = createApp({ engine })
  return { home, engine, app }
}

describe("trust API", () => {
  it("GET /trust and PUT always/none", async () => {
    const { app, engine } = setup()
    const get1 = await app.request("/api/trust")
    expect(get1.status).toBe(200)
    const body1 = (await get1.json()) as { trust: string }
    expect(body1.trust).toBe("none")

    const put = await app.request("/api/trust", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant: "always" }),
    })
    expect(put.status).toBe(200)
    expect(((await put.json()) as { trust: string }).trust).toBe("always")
    expect(engine.trustDecision()).toBe("always")

    const revoke = await app.request("/api/trust", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant: "none" }),
    })
    expect(revoke.status).toBe(200)
    expect(((await revoke.json()) as { trust: string }).trust).toBe("none")
    engine.close()
  })

  it("preflight and 409 trust_required on start", async () => {
    const { app, engine } = setup()
    const pre = await app.request("/api/workflows/agent-hi/runs/preflight", {
      method: "POST",
    })
    expect(pre.status).toBe(200)
    const preBody = (await pre.json()) as {
      trust: string
      needsAgentCli: boolean
      checks: unknown[]
    }
    expect(preBody.needsAgentCli).toBe(true)
    expect(preBody.trust).toBe("none")
    expect(preBody.checks.length).toBeGreaterThan(0)

    const start = await app.request("/api/workflows/agent-hi/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: "r1" }),
    })
    expect(start.status).toBe(409)
    const err = (await start.json()) as { error: string }
    expect(err.error).toBe("trust_required")

    const ok = await app.request("/api/workflows/agent-hi/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: "r2", trustGrant: "once" }),
    })
    expect(ok.status).toBe(200)
    engine.close()
  })
})

  it("GET /cli-status lists claude and cursor", async () => {
    const { app, engine } = setup()
    const res = await app.request("/api/cli-status")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      clis: Array<{ id: string; installed: boolean; version: string | null }>
    }
    expect(body.clis.map((c) => c.id).sort()).toEqual(["claude", "cursor"])
    for (const cli of body.clis) {
      expect(typeof cli.installed).toBe("boolean")
      expect(cli.version === null || typeof cli.version === "string").toBe(true)
    }
    engine.close()
  })

