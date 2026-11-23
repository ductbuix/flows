import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach } from "vitest"
import { describeEventStoreContract } from "@workspace/core/testing/event-store.contract"
import { createFakeEventStore } from "@workspace/core/testing"
import { createNodeEventStore, type NodeEventStore } from "./event-store.ts"

const temps: string[] = []
const openStores: NodeEventStore[] = []

afterEach(() => {
  while (openStores.length > 0) {
    openStores.pop()!.close()
  }
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describeEventStoreContract("EventStore", [
  ["fake", () => createFakeEventStore()],
  [
    "node",
    () => {
      const root = mkdtempSync(join(tmpdir(), "flowapp-eventstore-"))
      temps.push(root)
      const store = createNodeEventStore({
        dbPath: join(root, "events.sqlite"),
      })
      openStores.push(store)
      return store
    },
  ],
])
