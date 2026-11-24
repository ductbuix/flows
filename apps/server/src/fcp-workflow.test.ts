import { serve } from "@hono/node-server"
import {
  FCP_VERSION,
  workflowGetMethod,
  workflowListMethod,
  workflowSummarySchema,
  type WorkflowDetail,
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

type Harness = {
  home: string
  port: number
  token: string
  app: ReturnType<typeof createApp>
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
    app,
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

async function createWorkflow(
  app: ReturnType<typeof createApp>,
  body: { id: string; goal: string; name?: string }
) {
  const res = await app.request("/api/workflows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(201)
}

describe("workflow/list and workflow/get over /fcp", () => {
  it("matches REST list and get for the same workflows", async () => {
    const h = await startHarness()
    await createWorkflow(h.app, {
      id: "alpha",
      name: "Alpha",
      goal: "first",
    })
    await createWorkflow(h.app, { id: "beta", goal: "second" })
    await createWorkflow(h.app, {
      id: "gamma",
      name: "Gamma",
      goal: "third",
    })

    const restList = workflowSummarySchema
      .array()
      .parse(await (await h.app.request("/api/workflows")).json())
    const restDetail = (await (
      await h.app.request("/api/workflows/alpha")
    ).json()) as WorkflowDetail

    const { peer, socket } = await fcpPeer(h)

    const listed = workflowListMethod.result.parse(
      await peer.request("workflow/list", {})
    )
    expect(listed.items).toEqual(restList)
    expect(listed.next).toBeUndefined()

    const page = workflowListMethod.result.parse(
      await peer.request("workflow/list", { limit: 2 })
    )
    expect(page.items).toEqual(restList.slice(0, 2))
    expect(page.next).toBe("beta")
    const page2 = workflowListMethod.result.parse(
      await peer.request("workflow/list", { cursor: page.next, limit: 2 })
    )
    expect(page2.items).toEqual(restList.slice(2))
    expect(page2.next).toBeUndefined()

    const got = workflowGetMethod.result.parse(
      await peer.request("workflow/get", { id: "alpha" })
    )
    expect(got).toEqual(restDetail)

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
