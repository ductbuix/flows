import { describe, expect, it } from "vitest"
import { createEventBus } from "../kernel/event-bus.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { createDocketIndex } from "./index.ts"
import {
  attachRunFinishedRef,
  FLOWS_RUN_SYSTEM,
  flowsRunRefLabel,
} from "./run-ref.ts"
import { cardPath, createDocketStore, DOCKET_BOARD_PATH } from "./store.ts"

const boardYaml = `version: 1
columns:
  - { id: todo, label: Todo }
  - { id: doing, label: Doing }
`

const cardMd = (id: string) => `---
id: ${id}
title: Title ${id}
status: doing
rank: m
created: 2026-11-20T09:12:00Z
updated: 2026-11-20T09:12:00Z
refs:
  - system: rally
    id: US1
    label: External
---

Body.
`

function stack() {
  const docs = createFakeDocumentStore()
  docs.write(DOCKET_BOARD_PATH, boardYaml)
  docs.write(cardPath("fix-login"), cardMd("fix-login"))
  const store = createDocketStore({ docs, clock: createFakeClock() })
  const index = createDocketIndex({
    store,
    watcher: createFakeFileWatcher(),
    exists: () => true,
  })
  index.start()
  const bus = new UpdateBus()
  const events = createEventBus()
  const disposeListen = attachRunFinishedRef(events, { store, index, bus })
  return {
    store,
    index,
    bus,
    events,
    dispose: () => {
      disposeListen.dispose()
      index.dispose()
    },
  }
}

describe("run.finished → flows-run ref (BL-159)", () => {
  it("adds one ref per run with workflow and result in the label", () => {
    const { store, index, bus, events, dispose } = stack()
    const updates: unknown[] = []
    bus.subscribe(
      "t1",
      {
        notify: (_n: string, params: unknown) => {
          updates.push(params)
        },
      },
      { topics: ["docket"] }
    )

    events.emit("run.finished", {
      runId: "run-1",
      workflowId: "triage",
      status: "succeeded",
      cardId: "fix-login",
    })

    expect(store.readCard("fix-login")?.data?.refs).toEqual([
      { system: "rally", id: "US1", label: "External" },
      {
        system: FLOWS_RUN_SYSTEM,
        id: "run-1",
        label: flowsRunRefLabel("triage", "succeeded"),
      },
    ])
    expect(index.getCard("fix-login")?.refs).toHaveLength(2)
    expect(
      updates.some((u) => (u as { kind: string }).kind === "card_changed")
    ).toBe(true)

    events.emit("run.finished", {
      runId: "run-2",
      workflowId: "ship",
      status: "failed",
      cardId: "fix-login",
    })
    expect(
      store
        .readCard("fix-login")
        ?.data?.refs?.filter((r) => r.system === FLOWS_RUN_SYSTEM)
    ).toHaveLength(2)

    events.emit("run.finished", {
      runId: "run-1",
      workflowId: "triage",
      status: "failed",
      cardId: "fix-login",
    })
    const runRefs = store
      .readCard("fix-login")
      ?.data?.refs?.filter((r) => r.system === FLOWS_RUN_SYSTEM)
    expect(runRefs).toHaveLength(2)
    expect(runRefs?.find((r) => r.id === "run-1")?.label).toBe(
      flowsRunRefLabel("triage", "failed")
    )

    dispose()
  })

  it("ignores runs without a card id and missing cards", () => {
    const { store, events, dispose } = stack()
    events.emit("run.finished", {
      runId: "run-x",
      workflowId: "triage",
      status: "succeeded",
    })
    events.emit("run.finished", {
      runId: "run-y",
      workflowId: "triage",
      status: "succeeded",
      cardId: "missing-card",
    })
    expect(store.readCard("fix-login")?.data?.refs).toEqual([
      { system: "rally", id: "US1", label: "External" },
    ])
    dispose()
  })
})
