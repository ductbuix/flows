import {
  connectorSignOutResultSchema,
  connectorToYaml,
  type ConnectorFile,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { createInboxBindings } from "../inbox/bind.ts"
import { createInboxService } from "../inbox/service.ts"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeSecretStore,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { cookiesSecretKey, tokenSecretKey } from "./api-auth.ts"
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
  checkFn: () => Promise<ConnectorCheckResult>
): ConnectorTransportHandler {
  return {
    kind: "api",
    async call() {
      return { stdout: "", stderr: "", exitCode: 0 }
    },
    check: async () => checkFn(),
  }
}

describe("connector/sign_out (BL-207)", () => {
  it("clears secrets, marks off, and publishes status_changed", async () => {
    const docs = createFakeDocumentStore()
    docs.write(connectorPath(rally.id), connectorToYaml(rally))
    const service = createConnectorService({ docs })
    const secrets = createFakeSecretStore()
    secrets.set(cookiesSecretKey("rally"), "[]")
    secrets.set(tokenSecretKey("rally"), "tok")
    const transports = createConnectorTransportRegistry([
      fakeApiTransport(async () => ({ ok: true })),
    ])
    const runtime = createConnectorRuntime({ connectors: service, transports })
    const bus = new UpdateBus()
    const clock = createFakeClock(Date.parse("2026-11-24T12:00:00.000Z"))
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
          signIn: { secrets },
        }),
        ...createInboxBindings(inbox),
      },
      { signal: new AbortController().signal }
    )

    service.setStatus("rally", {
      status: "connected",
      checkedAt: "2026-11-24T11:00:00.000Z",
    })

    const updates: unknown[] = []
    bus.subscribe(
      "t1",
      {
        notify: (notification, params) => {
          updates.push({ notification, ...(params as object) })
        },
      },
      { topics: ["connector"] }
    )

    const result = connectorSignOutResultSchema.parse(
      await client.request("connector/sign_out", { id: "rally" })
    )
    expect(result).toEqual({ status: "off" })
    expect(secrets.get(cookiesSecretKey("rally"))).toBeNull()
    expect(secrets.get(tokenSecretKey("rally"))).toBeNull()
    expect(service.getStatus("rally")).toEqual({
      status: "off",
      checkedAt: "2026-11-24T12:00:00.000Z",
    })
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notification: "connector/update",
          kind: "status_changed",
          connectorId: "rally",
          status: "off",
        }),
      ])
    )

    const got = (await client.request("connector/get", { id: "rally" })) as {
      status: string
    }
    expect(got.status).toBe("off")
  })
})
