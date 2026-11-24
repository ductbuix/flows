import {
  docketAddAssetResultSchema,
  docketRemoveAssetResultSchema,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createSubscribeBindings } from "../updates/bind-subscribe.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import {
  createFakeBlobStore,
  createFakeClock,
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { createDocketIndex } from "./index.ts"
import { createDocketReadBindings } from "./read.ts"
import {
  cardPath,
  createDocketStore,
  DOCKET_BOARD_PATH,
  ownedAssetStorePath,
} from "./store.ts"
import { createDocketWriteBindings } from "./write.ts"

const boardYaml = `version: 1
columns:
  - { id: todo, label: Todo }
`

const cardMd = (id: string) => `---
id: ${id}
title: Title ${id}
status: todo
rank: m
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Body.
`

function streamOf(text: string): ReadableStream<Uint8Array> {
  const data = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
}

function stack(exists: (path: string) => boolean = () => true) {
  const docs = createFakeDocumentStore()
  docs.write(DOCKET_BOARD_PATH, boardYaml)
  docs.write(cardPath("alpha"), cardMd("alpha"))
  const store = createDocketStore({ docs, clock: createFakeClock() })
  const index = createDocketIndex({
    store,
    watcher: createFakeFileWatcher(),
    exists,
  })
  index.start()
  const bus = new UpdateBus()
  const blobs = createFakeBlobStore()
  return { docs, store, index, bus, blobs, dispose: () => index.dispose() }
}

function linkedClient(bindings: Record<string, unknown>, bus: UpdateBus) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  const { bindings: subBindings, dispose: subDispose } =
    createSubscribeBindings(bus, server, "peer-1")
  bindEngine(
    server,
    { ...bindings, ...subBindings },
    { signal: new AbortController().signal }
  )
  return {
    client,
    dispose: () => {
      subDispose.dispose()
    },
  }
}

describe("docket asset FCP", () => {
  it("adds an owned asset from a blob into assets/ and flags missing linked paths", async () => {
    const missing = new Set(["/gone/shot.png"])
    const { docs, store, index, bus, blobs, dispose } = stack(
      (path) => !missing.has(path)
    )
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({ index, store, bus, blobs })
    const { client: rpc, dispose: rpcDispose } = linkedClient(
      { ...read, ...write },
      bus
    )

    const before = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      hash: string
    }
    const ref = await blobs.put("docket/cards/alpha/assets", streamOf("hi\n"), {
      name: "note.md",
      mime: "text/markdown",
    })
    const owned = docketAddAssetResultSchema.parse(
      await rpc.request("docket/add_asset", {
        id: "alpha",
        scope: "owned",
        blobId: ref.id,
        name: "note.md",
        label: "Notes",
        baseHash: before.hash,
      })
    )
    expect(owned.asset).toMatchObject({
      path: "assets/note.md",
      label: "Notes",
      scope: "owned",
      missing: false,
    })
    expect(docs.read(ownedAssetStorePath("alpha", "note.md"))?.text).toBe(
      "hi\n"
    )

    const afterOwned = (await rpc.request("docket/get_card", {
      id: "alpha",
    })) as { hash: string; missingLinkedAssetCount: number }
    const linked = docketAddAssetResultSchema.parse(
      await rpc.request("docket/add_asset", {
        id: "alpha",
        scope: "linked",
        path: "/gone/shot.png",
        label: "Shot",
        baseHash: afterOwned.hash,
      })
    )
    expect(linked.asset).toMatchObject({
      path: "/gone/shot.png",
      scope: "linked",
      missing: true,
    })
    expect(docs.read(ownedAssetStorePath("alpha", "shot.png"))).toBeNull()

    const card = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      missingLinkedAssetCount: number
      assetCount: number
      assets: Array<{ path: string; missing: boolean }>
    }
    expect(card.assetCount).toBe(2)
    expect(card.missingLinkedAssetCount).toBe(1)
    expect(card.assets.find((a) => a.path === "/gone/shot.png")?.missing).toBe(
      true
    )

    dispose()
    rpcDispose()
  })

  it("remove_asset drops the entry but leaves the owned file on disk", async () => {
    const { docs, store, index, bus, blobs, dispose } = stack()
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({ index, store, bus, blobs })
    const { client: rpc, dispose: rpcDispose } = linkedClient(
      { ...read, ...write },
      bus
    )

    const before = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      hash: string
    }
    const ref = await blobs.put("card", streamOf("keep me"), {
      name: "keep.md",
    })
    const added = docketAddAssetResultSchema.parse(
      await rpc.request("docket/add_asset", {
        id: "alpha",
        scope: "owned",
        blobId: ref.id,
        name: "keep.md",
        baseHash: before.hash,
      })
    )
    expect(docs.read(ownedAssetStorePath("alpha", "keep.md"))?.text).toBe(
      "keep me"
    )

    const removed = docketRemoveAssetResultSchema.parse(
      await rpc.request("docket/remove_asset", {
        id: "alpha",
        path: "assets/keep.md",
        baseHash: added.hash,
      })
    )
    expect(removed.hash).toBeTruthy()
    expect(docs.read(ownedAssetStorePath("alpha", "keep.md"))?.text).toBe(
      "keep me"
    )

    const card = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      assetCount: number
      assets: unknown[]
    }
    expect(card.assetCount).toBe(0)
    expect(card.assets).toEqual([])

    dispose()
    rpcDispose()
  })
})
