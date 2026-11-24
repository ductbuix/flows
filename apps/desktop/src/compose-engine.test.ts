import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { MessageChannel } from "node:worker_threads"
import { afterEach, describe, expect, it } from "vitest"
import { createClient } from "@workspace/sdk"
import { messagePortTransport } from "@workspace/protocol"
import { composeDesktopEngine } from "./compose-engine.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function seedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-desktop-"))
  temps.push(home)
  mkdirSync(join(home, "docket/cards/alpha"), { recursive: true })
  mkdirSync(join(home, "docket/cards/beta"), { recursive: true })
  writeFileSync(
    join(home, "docket/board.yaml"),
    `version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
`
  )
  writeFileSync(
    join(home, "docket/cards/alpha/card.md"),
    `---
id: alpha
title: Alpha card
status: todo
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Alpha body.
`
  )
  writeFileSync(
    join(home, "docket/cards/beta/card.md"),
    `---
id: beta
title: Beta card
status: doing
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
---

Beta body.
`
  )
  return home
}

describe("composeDesktopEngine", () => {
  it("serves initialize and docket/list_cards over MessagePort", async () => {
    const home = seedHome()
    const engine = composeDesktopEngine(home)
    const channel = new MessageChannel()
    engine.bindPort(channel.port1)

    const client = createClient({
      transport: messagePortTransport(channel.port2),
      clientInfo: { name: "desktop-test", version: "0.0.0" },
    })
    await client.ready

    const listed = await client.call("docket/list_cards", {})
    expect(listed.items.map((c) => c.id).sort()).toEqual(["alpha", "beta"])
    expect(listed.items.find((c) => c.id === "alpha")?.title).toBe("Alpha card")

    client.close()
    engine.dispose()
    channel.port1.close()
    channel.port2.close()
  })
})
