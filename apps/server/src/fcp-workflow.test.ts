import { serve } from "@hono/node-server"
import {
  FCP_VERSION,
  workflowGetMethod,
  workflowListMethod,
} from "@workspace/contracts"
import { createEngine } from "@workspace/engine"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { createServer } from "node:net"
import { mkdtempSync, rmSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket, WebSocketServer } from "ws"
import { createApp } from "./app.ts"
import { createWorkflow } from "./workflow-lifecycle.ts"

type Harness = {
  home: string
  port: number
  token: string
  engine: ReturnType<typeof createEngine>
  close: () => Promise<void>
}

const homes: string[] = []
const harnesses: Harness[] = []

afterEach(async () => {
  for (const h of harnesses.splice(0)) {
    await h.close()
  }
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

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

async function startHarness(): Promise<Harness> {
  const home = mkdtempSync(join(tmpdir(), "flowapp-fcp-wf-"))
  homes.push(home)
  const token = "workflow-fcp-token"
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

  const harness: Harness = {
    home,
    port,
    token,
    engine,
    async close() {
      engine.close()
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
  harnesses.push(harness)
  return harness
}

async function fcpPeer(h: Harness): Promise<{
  peer: RpcPeer
  socket: WebSocket
}> {
  const socket = new WebSocket(
    `ws://127.0.0.1:${h.port}/fcp?token=${h.token}`,
    {
      headers: { Origin: `http://127.0.0.1:${h.port}` },
    }
  )
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve())
    socket.once("error", reject)
  })
  const peer = new RpcPeer(wsTransport(socket))
  await peer.request("initialize", {
    protocolVersion: FCP_VERSION,
    clientInfo: { name: "fcp-workflow-test", version: "0.0.0" },
    clientCapabilities: {},
  })
  return { peer, socket }
}

describe("workflow/list and workflow/get over /fcp", () => {
  it("lists and gets workflows created on disk", async () => {
    const h = await startHarness()
    expect(createWorkflow(h.engine, "alpha", "first", "Alpha").ok).toBe(true)
    expect(createWorkflow(h.engine, "beta", "second").ok).toBe(true)
    expect(createWorkflow(h.engine, "gamma", "third", "Gamma").ok).toBe(true)

    const { peer, socket } = await fcpPeer(h)

    const listed = workflowListMethod.result.parse(
      await peer.request("workflow/list", {})
    )
    expect(listed.items.map((w) => w.id)).toEqual(["alpha", "beta", "gamma"])
    expect(listed.next).toBeUndefined()

    const page = workflowListMethod.result.parse(
      await peer.request("workflow/list", { limit: 2 })
    )
    expect(page.items.map((w) => w.id)).toEqual(["alpha", "beta"])
    expect(page.next).toBe("beta")
    const page2 = workflowListMethod.result.parse(
      await peer.request("workflow/list", { cursor: page.next, limit: 2 })
    )
    expect(page2.items.map((w) => w.id)).toEqual(["gamma"])
    expect(page2.next).toBeUndefined()

    const got = workflowGetMethod.result.parse(
      await peer.request("workflow/get", { id: "alpha" })
    )
    expect(got.id).toBe("alpha")
    expect(got.workflow?.nodes?.some((n) => n.kind === "trigger")).toBe(true)
    expect(got.layout).toEqual({ version: 1, nodes: {} })

    socket.close()
  })

  it("returns not_found for a missing workflow", async () => {
    const h = await startHarness()
    const { peer, socket } = await fcpPeer(h)
    await expect(
      peer.request("workflow/get", { id: "missing" })
    ).rejects.toMatchObject({
      code: -32004,
      data: { code: "not_found" },
    })
    socket.close()
  })
})
