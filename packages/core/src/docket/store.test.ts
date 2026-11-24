import { describe, expect, it } from "vitest"
import { createFakeClock, createFakeDocumentStore } from "../testing/index.ts"
import {
  cardIdFromPath,
  cardPath,
  createDocketStore,
  DOCKET_BOARD_PATH,
} from "./store.ts"

const minimalCardMd = (id: string) => `---
id: ${id}
title: Sample
status: doing
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Body for ${id}.
`

const commentedCardMd = `---
id: half-valid
title: Half valid
status: todo
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
# note
x-extra: kept
---

Notes.
`

describe("DocketStore", () => {
  it("returns warnings instead of throwing for a half-valid card", () => {
    const docs = createFakeDocumentStore()
    const path = cardPath("half-valid")
    docs.write(
      path,
      `---
id: half-valid
title: Half valid
status: todo
---

No dates.
`
    )
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const card = store.readCard("half-valid")
    expect(card).not.toBeNull()
    expect(card!.data).toBeNull()
    expect(card!.text).toContain("No dates.")
    expect(card!.warnings.some((w) => w.includes("created"))).toBe(true)
  })

  it("lists broken yaml cards with folder id and raw text", () => {
    const docs = createFakeDocumentStore()
    docs.write(cardPath("broken"), "not: [valid: yaml\n---\n\nOops.\n")
    docs.write(cardPath("ok"), minimalCardMd("ok"))
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const cards = store.listCards()
    expect(cards.map((c) => c.id).sort()).toEqual(["broken", "ok"])
    const broken = cards.find((c) => c.id === "broken")!
    expect(broken.data).toBeNull()
    expect(broken.warnings.length).toBeGreaterThan(0)
    expect(broken.text).toContain("Oops.")
  })

  it("saveCard keeps comments, unknown keys and sets updated", () => {
    const docs = createFakeDocumentStore()
    docs.write(cardPath("half-valid"), commentedCardMd)
    const clock = createFakeClock(Date.parse("2026-11-24T02:00:00Z"))
    const store = createDocketStore({ docs, clock })
    const before = store.readCard("half-valid")!
    const written = store.saveCard(
      "half-valid",
      { title: "Renamed" },
      {
        baseHash: before.hash,
      }
    )
    expect(written.ok).toBe(true)
    const after = store.readCard("half-valid")!
    expect(after.text).toContain("# note")
    expect(after.text).toContain("x-extra: kept")
    expect(after.text).toContain("updated: 2026-11-24T02:00:00.000Z")
    expect(after.data?.title).toBe("Renamed")
  })

  it("writeBoardRaw conflicts on stale hash", () => {
    const docs = createFakeDocumentStore()
    const board = "version: 1\ncolumns:\n  - { id: todo, label: Todo }\n"
    docs.write(DOCKET_BOARD_PATH, board)
    const store = createDocketStore({ docs, clock: createFakeClock() })
    const disk = store.readBoard()!
    const conflict = store.writeBoardRaw(`${board}# edit\n`, "deadbeef")
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.kind).toBe("conflict")
    expect(disk.data?.columns).toHaveLength(1)
  })

  it("cardIdFromPath accepts optional leading slash from node adapters", () => {
    expect(cardIdFromPath("docket/cards/alpha/card.md")).toBe("alpha")
    expect(cardIdFromPath("/docket/cards/alpha/card.md")).toBe("alpha")
  })
})
