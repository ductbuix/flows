import {
  docketCreateCardResultSchema,
  docketSaveBoardResultSchema,
  ErrorCode,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createSubscribeBindings } from "../updates/bind-subscribe.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import {
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
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Body for ${id}.
`

function stack() {
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
  const bus = new UpdateBus()
  return { store, index, bus, dispose: () => index.dispose() }
}

function linkedBindings(bindings: Record<string, unknown>, bus: UpdateBus) {
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

describe("docket write FCP", () => {
  it("create, update, delete and save_board emit docket/update notifications", async () => {
    const { store, index, bus, dispose } = stack()
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({ index, store, bus })
    const { client: rpc, dispose: rpcDispose } = linkedBindings(
      { ...read, ...write },
      bus
    )
    const updates: unknown[] = []
    rpc.onNotification("docket/update", (params: unknown) => {
      updates.push(params)
    })
    await rpc.request("subscribe", { topics: ["docket"] })

    const created = docketCreateCardResultSchema.parse(
      await rpc.request("docket/create_card", {
        id: "new-card",
        title: "New card",
        body: "Fresh.",
      })
    )
    expect(created.hash).toBeTruthy()
    expect(created.rank).toBeTruthy()

    const before = await rpc.request("docket/get_card", { id: "alpha" })
    const updated = await rpc.request("docket/update_card", {
      id: "alpha",
      baseHash: (before as { hash: string }).hash,
      patch: { title: "Renamed alpha" },
    })
    expect((updated as { hash: string }).hash).toBeTruthy()

    const boardBeforeSave = (await rpc.request("docket/get_board", {})) as {
      hash: string
    }
    const saved = docketSaveBoardResultSchema.parse(
      await rpc.request("docket/save_board", {
        baseHash: boardBeforeSave.hash,
        board: {
          version: 1,
          columns: [
            { id: "todo", label: "Todo" },
            { id: "doing", label: "Doing" },
            { id: "review", label: "Review" },
          ],
        },
      })
    )
    expect(saved.hash).toBeTruthy()

    await rpc.request("docket/delete_card", { id: "new-card" })

    const kinds = updates.map((u) => (u as { kind: string }).kind)
    expect(kinds).toEqual([
      "card_changed",
      "card_changed",
      "board_changed",
      "card_removed",
    ])
    expect((updates[0] as { card: { id: string } }).card.id).toBe("new-card")

    dispose()
    rpcDispose()
  })

  it("returns conflict with the current card on stale baseHash", async () => {
    const { store, index, bus, dispose } = stack()
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({ index, store, bus })
    const { client: rpc, dispose: rpcDispose } = linkedBindings(
      { ...read, ...write },
      bus
    )

    try {
      await rpc.request("docket/update_card", {
        id: "alpha",
        baseHash: "stale",
        patch: { title: "Nope" },
      })
      expect.unreachable("expected conflict")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      const rpcErr = err as JsonRpcResponseError
      expect(rpcErr.code).toBe(ErrorCode.conflict)
      expect(rpcErr.data).toMatchObject({
        code: "conflict",
        current: {
          id: "alpha",
          title: "Title alpha",
        },
      })
      const current = (rpcErr.data as { current: { body: string } }).current
      expect(current.body.trim()).toBe("Body for alpha.")
    }

    dispose()
    rpcDispose()
  })

  it("save_board lists affected cards when a column is removed", async () => {
    const { store, index, bus, dispose } = stack()
    const read = createDocketReadBindings({ index, store })
    const write = createDocketWriteBindings({ index, store, bus })
    const { client: rpc, dispose: rpcDispose } = linkedBindings(
      { ...read, ...write },
      bus
    )
    const board = (await rpc.request("docket/get_board", {})) as {
      hash: string
    }

    try {
      await rpc.request("docket/save_board", {
        baseHash: board.hash,
        board: {
          version: 1,
          columns: [{ id: "todo", label: "Todo" }],
        },
      })
      expect.unreachable("expected invalid_params")
    } catch (err) {
      const data = (err as JsonRpcResponseError).data as {
        affectedCards: { id: string }[]
      }
      expect(data.affectedCards.map((c) => c.id)).toEqual(["busy"])
    }

    const migrated = docketSaveBoardResultSchema.parse(
      await rpc.request("docket/save_board", {
        baseHash: board.hash,
        board: {
          version: 1,
          columns: [{ id: "todo", label: "Todo" }],
        },
        migrateStatus: "todo",
      })
    )
    expect(migrated.migratedCardIds).toEqual(["busy"])
    const busy = await rpc.request("docket/get_card", { id: "busy" })
    expect((busy as { status: string }).status).toBe("todo")

    dispose()
    rpcDispose()
  })
})
