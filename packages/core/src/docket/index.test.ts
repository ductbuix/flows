import { describe, expect, it } from "vitest"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { createDocketIndex, UNSORTED_COLUMN_ID } from "./index.ts"
import { cardPath, createDocketStore, DOCKET_BOARD_PATH } from "./store.ts"

const boardYaml = `version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
`

const cardMd = (id: string, extra = "") => `---
id: ${id}
title: Title ${id}
status: doing
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
${extra}
---

Body.
`

const flushWatcher = () => new Promise<void>((resolve) => resolve())

describe("DocketIndex", () => {
  it("rebuilds faces and backlinks on start", () => {
    const docs = createFakeDocumentStore()
    docs.write(DOCKET_BOARD_PATH, boardYaml)
    docs.write(
      cardPath("source"),
      cardMd("source", `links:\n  - { to: target, rel: relates }`)
    )
    docs.write(cardPath("target"), cardMd("target"))
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const index = createDocketIndex({
      store,
      watcher: createFakeFileWatcher(),
      exists: () => true,
    })
    index.start()

    const target = index.getCard("target")
    expect(target?.backlinks).toEqual([{ from: "source", rel: "relates" }])
    expect(index.getCard("source")?.links[0]?.dangling).toBe(false)
    index.dispose()
  })

  it("picks up a hand edit on disk via the watcher", async () => {
    const docs = createFakeDocumentStore()
    docs.write(DOCKET_BOARD_PATH, boardYaml)
    docs.write(cardPath("live"), cardMd("live"))
    const watcher = createFakeFileWatcher()
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const index = createDocketIndex({
      store,
      watcher,
      exists: () => true,
    })
    index.start()
    expect(index.getCard("live")?.title).toBe("Title live")

    docs.write(
      cardPath("live"),
      cardMd("live").replace("Title live", "Edited by hand")
    )
    watcher.pulse(cardPath("live"))
    await flushWatcher()

    expect(index.getCard("live")?.title).toBe("Edited by hand")
    index.dispose()
  })

  it("flags dangling links and missing linked assets", () => {
    const docs = createFakeDocumentStore()
    docs.write(DOCKET_BOARD_PATH, boardYaml)
    docs.write(
      cardPath("lonely"),
      cardMd(
        "lonely",
        `links:\n  - { to: ghost-card, rel: blocks }\nassets:\n  - path: /gone/file.png\n    scope: linked`
      )
    )
    const missing = new Set(["/gone/file.png"])
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const index = createDocketIndex({
      store,
      watcher: createFakeFileWatcher(),
      exists: (path) => !missing.has(path),
    })
    index.start()

    const card = index.getCard("lonely")!
    expect(card.links[0]?.dangling).toBe(true)
    expect(card.missingLinkedAssetCount).toBe(1)
    expect(card.assets[0]?.missing).toBe(true)
    index.dispose()
  })

  it("sends unknown status to Unsorted", () => {
    const docs = createFakeDocumentStore()
    docs.write(DOCKET_BOARD_PATH, boardYaml)
    docs.write(
      cardPath("odd"),
      cardMd("odd").replace("status: doing", "status: backlog")
    )
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const index = createDocketIndex({
      store,
      watcher: createFakeFileWatcher(),
      exists: () => true,
    })
    index.start()

    expect(index.getCard("odd")?.columnId).toBe(UNSORTED_COLUMN_ID)
    index.dispose()
  })
})
