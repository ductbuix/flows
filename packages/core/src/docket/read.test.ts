import {
  docketGetBoardResultSchema,
  docketGetCardResultSchema,
  docketListCardsResultSchema,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { createDocketIndex } from "./index.ts"
import { createDocketReadBindings } from "./read.ts"
import { cardPath, createDocketStore, DOCKET_BOARD_PATH } from "./store.ts"

const boardYaml = `version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
`

const cardMd = (id: string, body: string) => `---
id: ${id}
title: Title ${id}
status: todo
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

${body}
`

function docketStack() {
  const docs = createFakeDocumentStore()
  docs.write(DOCKET_BOARD_PATH, boardYaml)
  docs.write(cardPath("alpha"), cardMd("alpha", "Alpha body."))
  docs.write(cardPath("beta"), cardMd("beta", "Beta body."))
  docs.write(cardPath("gamma"), cardMd("gamma", "Gamma body."))
  const store = createDocketStore({ docs, clock: createFakeClock() })
  const index = createDocketIndex({
    store,
    watcher: createFakeFileWatcher(),
    exists: () => true,
  })
  index.start()
  return { index, store, dispose: () => index.dispose() }
}

function linkedClient(bindings: ReturnType<typeof createDocketReadBindings>) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, bindings, { signal: new AbortController().signal })
  return client
}

describe("docket read FCP", () => {
  it("serves board, paged faces without bodies, and full card on get", async () => {
    const { index, store, dispose } = docketStack()
    const client = linkedClient(createDocketReadBindings({ index, store }))

    const board = docketGetBoardResultSchema.parse(
      await client.request("docket/get_board", {})
    )
    expect(board.board?.columns).toHaveLength(2)
    expect(board.hash).toBeTruthy()

    const page1 = docketListCardsResultSchema.parse(
      await client.request("docket/list_cards", { limit: 2 })
    )
    expect(page1.items.map((c) => c.id)).toEqual(["alpha", "beta"])
    expect(page1.items.every((c) => !("body" in c))).toBe(true)
    expect(page1.next).toBe("beta")

    const page2 = docketListCardsResultSchema.parse(
      await client.request("docket/list_cards", {
        cursor: page1.next,
        limit: 2,
      })
    )
    expect(page2.items.map((c) => c.id)).toEqual(["gamma"])
    expect(page2.next).toBeUndefined()

    const full = docketGetCardResultSchema.parse(
      await client.request("docket/get_card", { id: "alpha" })
    )
    expect(full.body.trim()).toBe("Alpha body.")
    expect(full.hash).toBeTruthy()
    expect(full.title).toBe("Title alpha")

    dispose()
  })
})
