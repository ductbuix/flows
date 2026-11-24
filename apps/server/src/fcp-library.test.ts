import { FCP_VERSION } from "@workspace/contracts"
import { RpcPeer, wsTransport } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { openFcpWs, startFcpServer } from "./fcp-harness.ts"

describe("library/* over /fcp", () => {
  it("lists seeded providers and saves a custom one", async () => {
    const h = await startFcpServer()
    const socket = await openFcpWs(h.port, h.token)
    const peer = new RpcPeer(wsTransport(socket))

    await peer.request("initialize", {
      protocolVersion: FCP_VERSION,
      clientInfo: { name: "fcp-library-test", version: "0.0.0" },
      clientCapabilities: {},
    })

    const listed = (await peer.request("library/list_providers", {})) as {
      items: Array<{ id: string }>
    }
    expect(listed.items.map((p) => p.id).sort()).toEqual([
      "confluence",
      "github",
      "rally",
    ])

    await peer.request("library/save_provider", {
      provider: {
        id: "jenkins",
        label: "Jenkins",
        icon: "ci",
        pattern: "jenkins[^/]*/job/(?<id>[^/]+)",
        example: "https://jenkins.example/job/x",
        layout: ["build.json"],
        tags: ["jenkins:{id}"],
        access: "read",
        fetch: "Jenkins API",
        custom: true,
      },
    })
    const after = (await peer.request("library/list_providers", {})) as {
      items: Array<{ id: string }>
    }
    expect(after.items.map((p) => p.id)).toContain("jenkins")
    socket.close()
  })
})
