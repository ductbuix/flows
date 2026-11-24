import {
  connectorCheckResultSchema,
  connectorToYaml,
  type ConnectorFile,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { createInboxBindings } from "../inbox/bind.ts"
import { signInItemId } from "../inbox/projection-sign-in.ts"
import { createInboxService } from "../inbox/service.ts"
import { bindEngine } from "../rpc/bind.ts"
import { createFakeClock, createFakeDocumentStore } from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createConnectorBindings } from "./bind.ts"
import { createConnectorTransportRegistry } from "./registry.ts"
import { createConnectorRuntime } from "./runtime.ts"
import { connectorPath, createConnectorService } from "./service.ts"
import type {
  ConnectorCheckResult,
  ConnectorTransportHandler,
} from "./transport.ts"

const rally: ConnectorFile = {
  id: "rally",
  name: "Rally",
  transport: "api",
  how: "https://rally.example/api",
  auth: "cookies",
  capabilities: [
    { name: "artifact read", desc: "Read", write: false, allowed: true },
  ],
}

function fakeApiTransport(
  checkFn: (
    connector: ConnectorFile,
    signal: AbortSignal
  ) => Promise<ConnectorCheckResult>
): ConnectorTransportHandler {
  return {
    kind: "api",
    async call() {
      return { stdout: "", stderr: "", exitCode: 0 }
    },
    check: checkFn,
  }
}

function stack(
  checkFn: (
    connector: ConnectorFile,
    signal: AbortSignal
  ) => Promise<ConnectorCheckResult>
) {
  const docs = createFakeDocumentStore()
  docs.write(connectorPath(rally.id), connectorToYaml(rally))
  const service = createConnectorService({ docs })
  const transports = createConnectorTransportRegistry([
    fakeApiTransport(checkFn),
  ])
  const runtime = createConnectorRuntime({ connectors: service, transports })
  const bus = new UpdateBus()
  const clock = createFakeClock(Date.parse("2026-11-24T10:00:00.000Z"))
  const inbox = createInboxService({
    bus,
    clock,
    pushAnswer: async () => {},
  })
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(
    server,
    {
      ...createConnectorBindings(service, {
        check: {
          runtime,
          bus,
          clock,
          onStatusChanged: (change) => inbox.applyConnectorStatus(change),
        },
      }),
      ...createInboxBindings(inbox),
    },
    { signal: new AbortController().signal }
  )
  return { client, bus, inbox }
}

describe("connector/check status and inbox (BL-164)", () => {
  it("publishes status_changed; expired adds a sign-in item, connected resolves it", async () => {
    let ok = false
    const { client, bus, inbox } = stack(async () => ({
      ok,
      detail: ok ? "cookies ok" : "cookies expired",
    }))

    const updates: unknown[] = []
    bus.subscribe(
      "t1",
      {
        notify: (notification, params) => {
          updates.push({ notification, ...(params as object) })
        },
      },
      { topics: ["connector", "inbox"] }
    )

    const expired = connectorCheckResultSchema.parse(
      await client.request("connector/check", { id: "rally" })
    )
    expect(expired).toEqual({
      status: "expired",
      detail: "cookies expired",
    })
    expect(inbox.openItems()).toEqual([
      expect.objectContaining({
        id: signInItemId("rally"),
        kind: "sign_in",
        connectorId: "rally",
        question: "Rally sign-in expired",
        status: "open",
      }),
    ])
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notification: "connector/update",
          kind: "status_changed",
          connectorId: "rally",
          status: "expired",
        }),
        expect.objectContaining({
          notification: "inbox/update",
          kind: "item_added",
          item: expect.objectContaining({
            kind: "sign_in",
            connectorId: "rally",
          }),
        }),
      ])
    )

    ok = true
    updates.length = 0
    const connected = connectorCheckResultSchema.parse(
      await client.request("connector/check", { id: "rally" })
    )
    expect(connected.status).toBe("connected")
    expect(inbox.openItems()).toEqual([])
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notification: "connector/update",
          kind: "status_changed",
          connectorId: "rally",
          status: "connected",
        }),
        expect.objectContaining({
          notification: "inbox/update",
          kind: "item_resolved",
          itemId: signInItemId("rally"),
        }),
      ])
    )
  })
})
