import {
  connectorGetResultSchema,
  connectorListResultSchema,
  connectorSaveResultSchema,
  connectorSetCapabilityResultSchema,
  connectorToYaml,
  ErrorCode,
  type ConnectorFile,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createFakeDocumentStore } from "../testing/index.ts"
import { createConnectorBindings } from "./bind.ts"
import { connectorPath, createConnectorService } from "./service.ts"

const github: ConnectorFile = {
  id: "github-cli",
  name: "GitHub",
  transport: "cli",
  how: "gh",
  auth: "cli-login",
  capabilities: [
    {
      name: "repo clone",
      desc: "Read repositories",
      write: false,
      allowed: true,
    },
    { name: "pr merge", desc: "Merge a PR", write: true, allowed: false },
  ],
}

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

function stack(seed: ConnectorFile[] = [github, rally]) {
  const docs = createFakeDocumentStore()
  for (const c of seed) {
    docs.write(connectorPath(c.id), connectorToYaml(c))
  }
  const service = createConnectorService({ docs })
  return { docs, service }
}

function linkedClient(service: ReturnType<typeof createConnectorService>) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, createConnectorBindings(service), {
    signal: new AbortController().signal,
  })
  return client
}

describe("connector FCP", () => {
  it("lists summaries, gets body, saves, sets capability and removes", async () => {
    const { service } = stack()
    const client = linkedClient(service)

    const page = connectorListResultSchema.parse(
      await client.request("connector/list", { limit: 1 })
    )
    expect(page.items.map((c) => c.id)).toEqual(["github-cli"])
    expect(page.items[0]).not.toHaveProperty("capabilities")
    expect(page.next).toBe("github-cli")

    const page2 = connectorListResultSchema.parse(
      await client.request("connector/list", {
        cursor: page.next,
        limit: 10,
      })
    )
    expect(page2.items.map((c) => c.id)).toEqual(["rally"])
    expect(page2.next).toBeUndefined()

    const got = connectorGetResultSchema.parse(
      await client.request("connector/get", { id: "github-cli" })
    )
    expect(got.connector.capabilities[1]?.allowed).toBe(false)
    expect(got.hash).toBeTruthy()

    const toggled = connectorSetCapabilityResultSchema.parse(
      await client.request("connector/set_capability", {
        id: "github-cli",
        name: "pr merge",
        allowed: true,
        baseHash: got.hash,
      })
    )
    expect(toggled.hash).toBeTruthy()
    const after = connectorGetResultSchema.parse(
      await client.request("connector/get", { id: "github-cli" })
    )
    expect(after.connector.capabilities[1]?.allowed).toBe(true)

    const saved = connectorSaveResultSchema.parse(
      await client.request("connector/save", {
        connector: {
          id: "opensearch",
          name: "OpenSearch",
          transport: "mcp",
          how: "npx -y opensearch-mcp",
          auth: "pat",
          capabilities: [{ name: "search logs", write: true }],
        },
      })
    )
    expect(saved.hash).toBeTruthy()
    const created = connectorGetResultSchema.parse(
      await client.request("connector/get", { id: "opensearch" })
    )
    expect(created.connector.capabilities[0]).toEqual({
      name: "search logs",
      desc: "",
      write: true,
      allowed: false,
    })

    await client.request("connector/remove", { id: "rally" })
    await expect(
      client.request("connector/get", { id: "rally" })
    ).rejects.toMatchObject({
      data: { code: "not_found" },
    })
  })

  it("rejects a secret value in connector YAML on get", async () => {
    const { docs, service } = stack([])
    docs.write(
      connectorPath("bad"),
      `id: bad
name: Bad
transport: api
how: https://example.com
auth: cookies
token: s3cret
`
    )
    const client = linkedClient(service)
    try {
      await client.request("connector/get", { id: "bad" })
      expect.unreachable("expected invalid connector to fail")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).data).toMatchObject({
        code: "invalid_params",
      })
    }
  })

  it("rejects secret keys on save params", async () => {
    const { service } = stack([])
    const client = linkedClient(service)
    try {
      await client.request("connector/save", {
        connector: {
          id: "x",
          name: "X",
          transport: "cli",
          how: "gh",
          auth: "cli-login",
          token: "nope",
        },
      })
      expect.unreachable("expected secret key to fail")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).code).toBe(ErrorCode.invalid_params)
    }
  })
})
