import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serve } from "@hono/node-server"
import { FCP_VERSION } from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { createServer, type AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { createApp } from "./app.ts"
import { trackTempHome } from "./fcp-harness.ts"

function writeSkill(
  home: string,
  dir: ".agents" | ".claude" | ".cursor",
  slug: string,
  opts: { description: string; from?: { sourceId: string; version: number } }
) {
  const folder = join(home, dir, "skills", slug)
  mkdirSync(folder, { recursive: true })
  const fromLine = opts.from
    ? `from:\n  sourceId: ${opts.from.sourceId}\n  version: ${opts.from.version}\n`
    : ""
  writeFileSync(
    join(folder, "SKILL.md"),
    `---\nname: ${slug}\ndescription: ${opts.description}\n${fromLine}---\n\n# ${slug}\n\nBody.\n`
  )
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo
      const { port } = addr
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
    server.on("error", reject)
  })
}

const closers: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

describe("skill/* over /fcp", () => {
  it("lists and gets workspace skills, then uninstalls", async () => {
    const home = trackTempHome(mkdtempSync(join(tmpdir(), "flowapp-skills-")))
    writeSkill(home, ".agents", "write-tests", {
      description: "Write focused unit tests.",
      from: { sourceId: "repo-team-skills", version: 1 },
    })
    writeSkill(home, ".claude", "write-tests", {
      description: "Write focused unit tests.",
      from: { sourceId: "repo-team-skills", version: 1 },
    })
    writeSkill(home, ".cursor", "commit-style", {
      description: "Write commit messages.",
    })

    const token = "skills-fcp-token"
    const port = await freePort()
    const engine = createEngine({ home })
    const app = createApp({ engine, fcpToken: token, port })
    const server = serve({
      fetch: app.fetch,
      hostname: "127.0.0.1",
      port,
      websocket: { server: new WebSocketServer({ noServer: true }) },
    })
    await new Promise<void>((resolve, reject) => {
      server.once("listening", () => resolve())
      server.once("error", reject)
    })

    const socket = new WebSocket(`ws://127.0.0.1:${port}/fcp?token=${token}`, {
      headers: { Origin: `http://127.0.0.1:${port}` },
    })
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve())
      socket.once("error", reject)
    })
    const peer = new RpcPeer(wsTransport(socket))
    closers.push(async () => {
      socket.close()
      engine.close()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    })

    await peer.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "fcp-skills-test", version: "0.0.0" },
      clientCapabilities: {},
    })

    const listed = (await peer.request("skill/list", {})) as {
      items: { slug: string; scope: string }[]
    }
    const items = listed.items.filter((s) => s.scope === "workspace")
    expect(items.map((s) => s.slug).sort()).toEqual([
      "commit-style",
      "write-tests",
    ])

    const detail = (await peer.request("skill/get", {
      slug: "write-tests",
      scope: "workspace",
    })) as { body: string; from?: { sourceId: string } }
    expect(detail.body).toContain("# write-tests")
    expect(detail.from?.sourceId).toBe("repo-team-skills")

    await peer.request("skill/uninstall", { slug: "write-tests" })
    const after = (await peer.request("skill/list", {})) as {
      items: { slug: string; scope: string }[]
    }
    expect(
      after.items.filter(
        (s) => s.scope === "workspace" && s.slug === "write-tests"
      )
    ).toEqual([])
  })
})
