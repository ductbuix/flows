import {
  DEFAULT_PROVIDERS,
  ErrorCode,
  libraryListProvidersResultSchema,
  type ProviderDescriptor,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createFakeDocumentStore } from "../testing/index.ts"
import { createLibraryProviderBindings } from "./bind.ts"
import { createProviderService, providerIdFromPath } from "./providers.ts"

function stack(presets?: readonly ProviderDescriptor[]) {
  const docs = createFakeDocumentStore()
  const service = createProviderService({
    docs,
    ...(presets ? { presets } : {}),
  })
  return { docs, service }
}

function linkedClient(service: ReturnType<typeof createProviderService>) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, createLibraryProviderBindings(service), {
    signal: new AbortController().signal,
  })
  return client
}

describe("library providers", () => {
  it("reads provider id from store paths with or without a leading slash", () => {
    expect(providerIdFromPath("providers/github.yaml")).toBe("github")
    expect(providerIdFromPath("/providers/github.yaml")).toBe("github")
  })

  it("seeds GitHub, Confluence and Rally presets", () => {
    const { service } = stack()
    expect(service.list().map((p) => p.id)).toEqual([
      "confluence",
      "github",
      "rally",
    ])
  })

  it("recognises links per preset", () => {
    const { service } = stack()
    expect(service.match(DEFAULT_PROVIDERS[0]!.example)?.provider.id).toBe(
      "github"
    )
    expect(service.match(DEFAULT_PROVIDERS[1]!.example)?.provider.id).toBe(
      "confluence"
    )
    expect(service.match(DEFAULT_PROVIDERS[2]!.example)?.provider.id).toBe(
      "rally"
    )
  })

  it("lists and saves providers over FCP", async () => {
    const { service } = stack()
    const client = linkedClient(service)

    const page = libraryListProvidersResultSchema.parse(
      await client.request("library/list_providers", { limit: 1 })
    )
    expect(page.items.map((p) => p.id)).toEqual(["confluence"])
    expect(page.next).toBe("confluence")

    const jenkins: ProviderDescriptor = {
      id: "jenkins",
      label: "Jenkins",
      icon: "ci",
      pattern: "jenkins[^/]*/job/(?<id>[^/]+)",
      example: "https://jenkins.example/job/auth-ci/4412",
      layout: ["build.json", "console.log"],
      tags: ["jenkins:{id}", "type:build"],
      access: "read",
      fetch: "Jenkins JSON API",
      custom: true,
    }
    await client.request("library/save_provider", { provider: jenkins })
    expect(service.list().map((p) => p.id)).toContain("jenkins")
    expect(service.match(jenkins.example)?.id).toBe("auth-ci")
  })

  it("rejects save_provider with an invalid pattern as invalid_params", async () => {
    const { service } = stack()
    const client = linkedClient(service)
    try {
      await client.request("library/save_provider", {
        provider: {
          id: "bad",
          label: "Bad",
          icon: "other",
          pattern: "[",
          example: "",
          layout: ["x.md"],
          tags: [],
          access: "read",
          fetch: "x",
        },
      })
      expect.unreachable("expected invalid pattern to fail")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).code).toBe(ErrorCode.invalid_params)
    }
  })

  it("rejects a pattern without a named group id as invalid_params", async () => {
    const { service } = stack()
    const client = linkedClient(service)
    try {
      await client.request("library/save_provider", {
        provider: {
          id: "bad",
          label: "Bad",
          icon: "other",
          pattern: "host/([^/]+)",
          example: "",
          layout: ["x.md"],
          tags: [],
          access: "read",
          fetch: "x",
        },
      })
      expect.unreachable("expected missing id group to fail")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).code).toBe(ErrorCode.invalid_params)
    }
  })
})
