import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import { createHost } from "@workspace/adapters-node"
import { createCoreRunHost } from "./core-run-host.ts"

const homes: string[] = []
afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

const graph = workflowSchema.parse({
  id: "card-wf",
  nodes: [
    { id: "t", kind: "trigger", type: "manual" },
    { id: "a", kind: "command", run: "echo ok" },
    { id: "o", kind: "output", target: "folder" },
  ],
  edges: [
    { from: "t", to: "a" },
    { from: "a", to: "o" },
  ],
})

function writeDocketCard(home: string, cardId: string, title: string): void {
  mkdirSync(join(home, "docket", "cards", cardId), { recursive: true })
  writeFileSync(
    join(home, "docket", "cards", cardId, "card.md"),
    [
      "---",
      `id: ${cardId}`,
      `title: ${title}`,
      "status: doing",
      "created: 2026-11-01",
      "updated: 2026-11-01",
      "---",
      "",
    ].join("\n")
  )
}

describe("core runs carry cardId (BL-197)", () => {
  it("records cardId on run_started and in the summary", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-core-card-"))
    homes.push(home)
    const cardId = "story-one"
    writeDocketCard(home, cardId, "Story one")
    const engine = createHost({ home })
    const host = createCoreRunHost(engine)

    await host.tryStart({
      graph,
      runId: "r1",
      inputText: "T-1",
      cardId,
    })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const s = engine.fold("r1")
      if (s && s.status !== "running" && s.status !== "queued") break
      await new Promise((r) => setTimeout(r, 25))
    }

    expect(engine.fold("r1")?.cardId).toBe(cardId)
    const summary = engine.listRunSummaries({ cardId })
    expect(summary).toHaveLength(1)
    expect(summary[0]).toMatchObject({ id: "r1", cardId })
    expect(engine.listRunSummaries({ cardId: "other" })).toEqual([])
    host.dispose()
    engine.close()
  }, 15_000)
})
