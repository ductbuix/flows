import { acquireLock, peekLock, releaseLock } from "@workspace/adapters-node"
import { createEngine } from "@workspace/adapters-node"
import { serve } from "@hono/node-server"
import { createApp } from "server/app"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocketServer } from "ws"
import { runInbox } from "./commands/inbox.ts"
import { runWorkflow } from "./commands/run.ts"
import { engineBusyMessage, openInProcess, openSession } from "./session.ts"

const homes: string[] = []
const closers: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close()
  }
  for (const home of homes.splice(0)) {
    releaseLock(home)
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-cli-"))
  homes.push(home)
  return home
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

function writeDemoWorkflow(home: string): void {
  const dir = join(home, "workflows", "demo")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - id: a
    kind: command
    run: "printf hi > \\"$NODE_OUT/out.txt\\""
edges:
  - { from: t, to: a }
`
  )
}

function writeApprovalWorkflow(home: string): void {
  const dir = join(home, "workflows", "ask")
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "workflow.yaml"),
    `id: ask
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: gate, kind: approval, question: Ship it? }
  - { id: after, kind: command, run: "echo ok" }
edges:
  - { from: t, to: gate }
  - { from: gate, to: after }
`
  )
}

async function startLockedDaemon(home: string): Promise<{
  port: number
  token: string
}> {
  const token = "cli-attach-token"
  const port = await freePort()
  const engine = createEngine({ home })
  const app = createApp({ engine, fcpToken: token, port })
  const lock = acquireLock(home, {
    url: `ws://127.0.0.1:${port}/fcp`,
    token,
  })
  expect(lock).toEqual({ owned: true })

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
  closers.push(async () => {
    releaseLock(home)
    engine.close()
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })
  return { port, token }
}

describe("flows CLI", () => {
  it("in-process takes and releases engine.lock", async () => {
    const home = tempHome()
    expect(peekLock(home)).toBeNull()
    const session = await openInProcess(home)
    expect(session.mode).toBe("in-process")
    expect(peekLock(home)).toMatchObject({
      url: "inproc://flows-cli",
      pid: process.pid,
    })
    session.close()
    expect(peekLock(home)).toBeNull()
  })

  it("second in-process call fails while the first holds the lock", async () => {
    const home = tempHome()
    const first = await openInProcess(home)
    await expect(openInProcess(home)).rejects.toThrow(
      engineBusyMessage(process.pid)
    )
    first.close()
    const again = await openInProcess(home)
    expect(again.mode).toBe("in-process")
    again.close()
  })

  it("runs in-process against a temp home and exits 0 on success", async () => {
    const home = tempHome()
    writeDemoWorkflow(home)
    expect(peekLock(home)).toBeNull()
    const code = await runWorkflow({
      home,
      workflowId: "demo",
    })
    expect(code).toBe(0)
    expect(peekLock(home)).toBeNull()
  }, 30_000)

  it("lists open inbox items from a live daemon", async () => {
    const home = tempHome()
    writeApprovalWorkflow(home)
    await startLockedDaemon(home)

    const seed = await openSession(home)
    expect(seed.mode).toBe("attach")
    await seed.client.call("run/start", {
      workflowId: "ask",
      requestKey: "00000000-0000-4000-8000-000000000001",
    })
    const deadline = Date.now() + 10_000
    let listed = await seed.client.call("inbox/list", {})
    while (listed.items.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50))
      listed = await seed.client.call("inbox/list", {})
    }
    seed.close()

    const chunks: string[] = []
    const write = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk))
      return true
    }) as typeof process.stdout.write
    try {
      const code = await runInbox(home)
      expect(code).toBe(0)
      expect(chunks.join("")).toMatch(/approval\topen\tShip it\?/)
    } finally {
      process.stdout.write = write
    }
  }, 30_000)

  it("attaches when engine.lock names a live owner", async () => {
    const home = tempHome()
    writeDemoWorkflow(home)
    const { port, token } = await startLockedDaemon(home)
    const session = await openSession(home)
    expect(session.mode).toBe("attach")
    expect(peekLock(home)).toMatchObject({
      url: `ws://127.0.0.1:${port}/fcp`,
      token,
    })
    session.close()
    const code = await runWorkflow({ home, workflowId: "demo" })
    expect(code).toBe(0)
  }, 30_000)
})
