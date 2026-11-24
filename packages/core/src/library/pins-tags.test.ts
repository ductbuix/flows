import {
  LibItemId,
  libItemToYaml,
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
import { createProviderService } from "./providers.ts"
import { createLibraryService } from "./service.ts"
import { itemYamlPath, writeVersion } from "./versions.ts"

const ITEM_ID = LibItemId.parse("github-acme-demo")
const OTHER_ID = LibItemId.parse("local-notes")

function seedItem(
  docs: ReturnType<typeof createFakeDocumentStore>,
  overrides: Partial<LibItemDisk> = {}
): LibItemDisk {
  const item: LibItemDisk = {
    id: ITEM_ID,
    kind: "repo",
    title: "GitHub acme/demo",
    source: "github",
    remoteId: "acme/demo",
    remoteUrl: "https://github.com/acme/demo",
    tags: ["repo:acme/demo", "project:auth"],
    current: 1,
    ...overrides,
  }
  docs.write(itemYamlPath(item.id), libItemToYaml(item))
  return item
}

function seedVersion(
  docs: ReturnType<typeof createFakeDocumentStore>,
  id: string,
  n: number
) {
  writeVersion(
    docs,
    id,
    {
      n,
      at: "2026-11-24T00:00:00.000Z",
      note: `v${n}`,
      contentHash: `hash-${n}`,
    },
    { "README.md": `content-${n}` }
  )
}

function noopFetcher(): LibraryFetcher {
  return {
    async fetch() {
      return { files: { "README.md": "x" } }
    },
  }
}

function stack(docs = createFakeDocumentStore()) {
  const bus = new UpdateBus()
  const library = createLibraryService({
    docs,
    bus,
    ids: createFakeIds(),
    clock: createFakeClock(1_700_000_000_000),
    fetcher: noopFetcher(),
  })
  return { docs, bus, library }
}

async function rpcOf(
  docs: ReturnType<typeof createFakeDocumentStore>,
  library: ReturnType<typeof createLibraryService>
) {
  const providers = createProviderService({ docs })
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, createLibraryBindings(providers, library), {
    signal: new AbortController().signal,
  })
  return client
}

describe("library pins and tags (BL-173)", () => {
  it("pins a version, sets tags, and lists by tag over FCP", async () => {
    const { docs, library } = stack()
    seedItem(docs, {
      current: 2,
      tags: ["repo:acme/demo"],
    })
    seedVersion(docs, ITEM_ID, 1)
    seedVersion(docs, ITEM_ID, 2)
    seedItem(docs, {
      id: OTHER_ID,
      kind: "other",
      title: "Notes",
      source: "local",
      tags: ["project:auth"],
      current: 1,
      remoteId: undefined,
      remoteUrl: undefined,
    })
    const client = await rpcOf(docs, library)

    const pinned = (await client.request("library/pin_version", {
      id: ITEM_ID,
      n: 1,
    })) as LibItem
    expect(pinned.current).toBe(1)

    const tagged = (await client.request("library/set_tags", {
      id: ITEM_ID,
      tags: ["repo:acme/demo", "team:platform"],
    })) as LibItem
    expect(tagged.tags).toEqual(["repo:acme/demo", "team:platform"])

    const byTag = (await client.request("library/list", {
      tag: "project:auth",
    })) as { items: LibItem[] }
    expect(byTag.items.map((i) => i.id)).toEqual([OTHER_ID])

    const byRepo = (await client.request("library/list", {
      tag: "repo:acme/demo",
    })) as { items: LibItem[] }
    expect(byRepo.items.map((i) => i.id)).toEqual([ITEM_ID])
  })

  it("rejects remove when a card refs the item with busy + users", async () => {
    const { docs, library } = stack()
    seedItem(docs, { tags: ["repo:acme/demo"] })
    seedVersion(docs, ITEM_ID, 1)
    docs.write(
      "docket/cards/fix-login/card.md",
      `---
id: fix-login
title: Fix login
status: todo
created: 2026-11-24T00:00:00.000Z
updated: 2026-11-24T00:00:00.000Z
refs:
  - system: library
    id: ${ITEM_ID}
---

Body
`
    )
    const client = await rpcOf(docs, library)

    await expect(
      client.request("library/remove", { id: ITEM_ID })
    ).rejects.toMatchObject({
      data: { code: "busy", users: ["fix-login"] },
    })
    expect(library.get(ITEM_ID)).not.toBeNull()
  })

  it("removes an unused item over FCP", async () => {
    const { docs, library } = stack()
    seedItem(docs, { tags: ["repo:acme/demo"] })
    seedVersion(docs, ITEM_ID, 1)
    const client = await rpcOf(docs, library)

    await client.request("library/remove", { id: ITEM_ID })
    expect(library.get(ITEM_ID)).toBeNull()
  })

  it("rejects tags that are not namespace:value at the FCP boundary", async () => {
    const { docs, library } = stack()
    seedItem(docs, { tags: ["repo:acme/demo"] })
    const client = await rpcOf(docs, library)

    await expect(
      client.request("library/set_tags", {
        id: ITEM_ID,
        tags: ["not-a-tag"],
      })
    ).rejects.toMatchObject({ data: { code: "invalid_params" } })
  })
})
