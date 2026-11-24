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
import { cardPath, createDocketStore, DOCKET_BOARD_PATH } from "./store.ts"
import { createDocketWriteBindings } from "./write.ts"

const boardYaml = `version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
`

const cardMd = (id: string, status = "todo") => `---
id: ${id}
title: Title ${id}
status: ${status}
rank: m
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Body for ${id}.
`

describe("docket update_card patches (BL-198)", () => {
  it("updates refs, fields, links and clears start/due with null", async () => {
    const docs = createFakeDocumentStore()
    docs.write(DOCKET_BOARD_PATH, boardYaml)
    docs.write(cardPath("alpha"), cardMd("alpha"))
    docs.write(cardPath("busy"), cardMd("busy", "doing"))
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const index = createDocketIndex({
      store,
      watcher: createFakeFileWatcher(),
      exists: () => true,
    })
    index.start()
    store.saveCard("alpha", { start: "2026-11-20", due: "2026-11-28" })
    index.refreshCard("alpha")

    const bus = new UpdateBus()
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({
      index,
      store,
      bus,
      blobs: createFakeBlobStore(),
    })
    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const rpc = new RpcPeer(clientTransport)
    const { bindings: subBindings, dispose: subDispose } =
      createSubscribeBindings(bus, server, "peer-1")
    bindEngine(
      server,
      { ...read, ...write, ...subBindings },
      { signal: new AbortController().signal }
    )

    const before = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      hash: string
      start?: string
      due?: string
    }
    expect(before.start).toBe("2026-11-20")
    expect(before.due).toBe("2026-11-28")

    await rpc.request("docket/update_card", {
      id: "alpha",
      baseHash: before.hash,
      patch: {
        refs: [{ system: "github", url: "https://github.com/x/y", label: "y" }],
        fields: { assignee: "dbx" },
        links: [{ to: "busy", rel: "blocks" }],
        start: null,
        due: null,
      },
    })

    const after = (await rpc.request("docket/get_card", { id: "alpha" })) as {
      refs: { system: string }[]
      fields?: Record<string, unknown>
      links: { to: string; rel: string; dangling: boolean }[]
      start?: string
      due?: string
    }
    expect(after.refs).toEqual([
      { system: "github", url: "https://github.com/x/y", label: "y" },
    ])
    expect(after.fields).toEqual({ assignee: "dbx" })
    expect(after.links).toEqual([
      { to: "busy", rel: "blocks", dangling: false },
    ])
    expect(after.start).toBeUndefined()
    expect(after.due).toBeUndefined()

    subDispose.dispose()
    index.dispose()
  })
})
