import {
  DEFAULT_PROVIDERS,
  LibItemId,
  libItemToYaml,
  providerToYaml,
  type LibItem,
  type LibItemDisk,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeIds,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createLibraryBindings } from "./bind.ts"
import type { LibraryFetcher } from "./fetch.ts"
import { createProviderService, providerPath } from "./providers.ts"
import { createLibraryService } from "./service.ts"
import { itemYamlPath, writeVersion } from "./versions.ts"

const ITEM_ID = LibItemId.parse("github-acme-demo")

function seedProviders(docs: ReturnType<typeof createFakeDocumentStore>) {
  for (const p of DEFAULT_PROVIDERS) {
    docs.write(providerPath(p.id), providerToYaml(p))
  }
}

function seedItem(
  docs: ReturnType<typeof createFakeDocumentStore>,
  overrides: Partial<LibItemDisk> = {}
) {
  const item: LibItemDisk = {
    id: ITEM_ID,
    kind: "repo",
    title: "GitHub acme/demo",
    source: "github",
    remoteId: "acme/demo",
    remoteUrl: "https://github.com/acme/demo",
    tags: ["repo:acme/demo"],
    current: 1,
    ...overrides,
  }
  docs.write(itemYamlPath(item.id), libItemToYaml(item))
  writeVersion(
    docs,
    item.id,
    {
      n: 1,
      at: "2026-11-24T00:00:00.000Z",
      note: "v1",
      contentHash: "hash-1",
    },
    { "README.md": "hello" }
  )
}

function fetcher(): LibraryFetcher {
  return {
    async fetch() {
      return { files: { "README.md": "pulled" }, note: "Pulled" }
    },
    async push() {
      return { note: "Pushed stub" }
    },
  }
}

async function rpc(docs = createFakeDocumentStore()) {
  seedProviders(docs)
  const bus = new UpdateBus()
  const library = createLibraryService({
    docs,
    bus,
    ids: createFakeIds(),
    clock: createFakeClock(1_700_000_000_000),
    fetcher: fetcher(),
  })
  const providers = createProviderService({ docs })
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, createLibraryBindings(providers, library), {
    signal: new AbortController().signal,
  })
  return { client, library, docs }
}

describe("library add, push and unlink (BL-205)", () => {
  it("adds from a remote link and from local files", async () => {
    const { client, library } = await rpc()
    const remote = (await client.request("library/add", {
      kind: "remote",
      url: "https://github.com/acme/new-repo",
    })) as LibItem
    expect(remote.id).toBe("github-acme-new-repo")
    expect(remote.source).toBe("github")
    expect(remote.remoteId).toBe("acme/new-repo")
    expect(remote.tags).toContain("repo:acme/new-repo")

    const local = (await client.request("library/add", {
      kind: "local",
      title: "Brand guidelines",
      itemKind: "other",
      tags: ["type:design"],
      files: { "guide.md": "# Guide" },
    })) as LibItem
    expect(local.source).toBe("local")
    expect(local.title).toBe("Brand guidelines")
    expect(local.versions).toHaveLength(1)
    expect(library.get(local.id)?.versions[0]?.note).toBe("Added from disk")
  })

  it("pushes and unlinks a linked item", async () => {
    const docs = createFakeDocumentStore()
    seedItem(docs)
    const { client, library } = await rpc(docs)

    const push = (await client.request("library/push", {
      id: ITEM_ID,
    })) as { jobId: string }
    await library.flush()
    expect(push.jobId).toBe("job_0")
    expect(library.get(ITEM_ID)?.versions[0]?.note).toBe("Pushed stub")

    const unlinked = (await client.request("library/unlink", {
      id: ITEM_ID,
    })) as LibItem
    expect(unlinked.source).toBe("local")
    expect(unlinked.remoteId).toBeUndefined()
    expect(unlinked.versions.length).toBeGreaterThan(0)
  })
})
