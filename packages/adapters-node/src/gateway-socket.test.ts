import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createConnection } from "node:net"
import { connectorToYaml, type ConnectorFile } from "@workspace/contracts"
import {
  createCliTransport,
  createConnectorRuntime,
  createConnectorService,
  createConnectorTransportRegistry,
  createMcpGatewayBridge,
  connectorPath,
  GATEWAY_CALL_METHOD,
} from "@workspace/core"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeEventStore,
  createFakeIds,
  createFakeProcessRunner,
} from "@workspace/core/testing"
import { JsonRpcResponseError, RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { afterEach, describe, expect, it } from "vitest"
import { createNodeGatewaySocketServer } from "./gateway-socket.ts"

const github: ConnectorFile = {
  id: "github",
  name: "GitHub",
  transport: "cli",
  how: "gh-stub",
  auth: "cli-login",
  capabilities: [
    {
      name: "repo clone",
      desc: "Read",
      write: false,
      allowed: true,
      cmd: ["repo", "clone"],
    },
    {
      name: "pr create",
      desc: "Write",
      write: true,
      allowed: true,
      cmd: ["pr", "create"],
    },
  ],
}

const tools = [
  {
    name: "github.repo_clone",
    connectorId: "github",
    capability: "repo clone",
  },
  {
    name: "github.pr_create",
    connectorId: "github",
    capability: "pr create",
  },
] as const

type Session = Awaited<
  ReturnType<ReturnType<typeof createMcpGatewayBridge>["openStep"]>
>

async function openBridge() {
  const dir = mkdtempSync(join(tmpdir(), "flows-gw-"))
  const socketPath = join(dir, "gateway.sock")
  const toolsPath = join(dir, "tools.json")
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(github.id), connectorToYaml(github))
  const connectors = createConnectorService({ docs })
  const runner = createFakeProcessRunner()
  runner.on("gh-stub", (spec) => ({
    stdout: `ok ${[spec.command, ...(spec.args ?? [])].join(" ")}\n`,
    exitCode: 0,
  }))
  const events = createFakeEventStore()
  const bridge = createMcpGatewayBridge({
    sockets: createNodeGatewaySocketServer(),
    runtime: createConnectorRuntime({
      connectors,
      transports: createConnectorTransportRegistry([
        createCliTransport(runner),
      ]),
    }),
    connectors,
    events,
    clock: createFakeClock(1_700_000_000_000),
    ids: createFakeIds(),
  })
  const session = await bridge.openStep({
    runId: "r1",
    nodeId: "agent",
    pass: 1,
    socketPath,
    toolsPath,
    tools: [...tools],
    permission: {
      allowedRoots: ["/work"],
      connectorWriteEnabled: false,
      nodeAllowlist: ["github.repo_clone"],
      rememberedAllowAlways: [],
    },
    gatewayCommand: "flows-mcp-gateway",
  })
  writeFileSync(toolsPath, session.toolsJson)
  return { session, events, socketPath, dir }
}

async function callGateway(
  socketPath: string,
  token: string,
  name: string,
  args: Record<string, unknown>
) {
  const socket = await new Promise<ReturnType<typeof createConnection>>(
    (resolve, reject) => {
      const s = createConnection({ path: socketPath }, () => resolve(s))
      s.once("error", reject)
    }
  )
  const peer = new RpcPeer(ndjsonTransport(socket, socket))
  try {
    return await peer.request(GATEWAY_CALL_METHOD, {
      name,
      arguments: args,
      token,
    })
  } finally {
    peer.close()
    socket.destroy()
  }
}

describe("gateway socket + stub connector", () => {
  const sessions: Session[] = []

  afterEach(async () => {
    while (sessions.length > 0) {
      await sessions.pop()!.close()
    }
  })

  it("allows a read call, logs connector_called, refuses a bad token", async () => {
    const { session, events, socketPath } = await openBridge()
    sessions.push(session)

    const result = (await callGateway(
      socketPath,
      session.token,
      "github.repo_clone",
      { args: ["acme/demo"] }
    )) as { content: Array<{ text: string }>; isError?: boolean }

    expect(result.isError).toBeUndefined()
    expect(result.content[0]?.text).toContain("gh-stub repo clone acme/demo")
    expect(events.read("r1").map((s) => s.event)).toEqual([
      expect.objectContaining({
        type: "connector_called",
        capability: "repo clone",
        status: "ok",
      }),
    ])

    const err = await callGateway(socketPath, "wrong", "github.repo_clone", {
      args: ["x"],
    }).then(
      () => null,
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(JsonRpcResponseError)
    expect((err as JsonRpcResponseError).message).toMatch(/unknown step token/)
  })

  it("denies a write capability when connector writes are off", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flows-gw-"))
    const socketPath = join(dir, "gateway.sock")
    const toolsPath = join(dir, "tools.json")
    const docs = createFakeDocumentStore()
    docs.write(connectorPath(github.id), connectorToYaml(github))
    const connectors = createConnectorService({ docs })
    const events = createFakeEventStore()
    const bridge = createMcpGatewayBridge({
      sockets: createNodeGatewaySocketServer(),
      runtime: createConnectorRuntime({
        connectors,
        transports: createConnectorTransportRegistry([
          createCliTransport(createFakeProcessRunner()),
        ]),
      }),
      connectors,
      events,
      clock: createFakeClock(0),
      ids: createFakeIds(),
    })
    const session = await bridge.openStep({
      runId: "r2",
      nodeId: "agent",
      pass: 1,
      socketPath,
      toolsPath,
      tools: [...tools],
      permission: {
        allowedRoots: ["/work"],
        connectorWriteEnabled: false,
        nodeAllowlist: ["github.pr_create"],
        rememberedAllowAlways: [],
      },
      gatewayCommand: "flows-mcp-gateway",
    })
    sessions.push(session)
    writeFileSync(toolsPath, session.toolsJson)

    const result = (await callGateway(
      socketPath,
      session.token,
      "github.pr_create",
      { title: "hi" }
    )) as { content: Array<{ text: string }>; isError?: boolean }

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/denied by connector/)
    expect(events.read("r2")[0]?.event).toEqual(
      expect.objectContaining({
        type: "connector_called",
        capability: "pr create",
        status: "denied",
      })
    )
  })

  it("removes the socket when the step ends", async () => {
    const { session, socketPath } = await openBridge()
    await session.close()
    const err = await new Promise<Error>((resolve) => {
      const s = createConnection({ path: socketPath })
      s.once("error", (e) => resolve(e))
      s.once("connect", () => {
        s.destroy()
        resolve(new Error("socket still accepting"))
      })
    })
    expect(err.message).toMatch(/ENOENT|ECONNREFUSED/)
  })
})
