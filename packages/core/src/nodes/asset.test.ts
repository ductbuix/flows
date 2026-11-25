import { describe, expect, it } from "vitest"
import { createFakeDocumentStore } from "../testing/fake-document-store.ts"
import { createStepContext } from "./context.ts"
import { assetKind } from "./kinds/asset.ts"
import { collectExecute } from "./run.ts"

const runDir = "workflows/wf/runs/r1"

describe("asset kind (fixed)", () => {
  it("emits the current version of picked library items", async () => {
    const docs = createFakeDocumentStore()
    docs.write(
      "library/brief/item.yaml",
      "id: brief\nkind: other\ntitle: Brief\nsource: local\ncurrent: 2\n"
    )
    docs.write("library/brief/v1/brief.md", "old")
    docs.write("library/brief/v2/brief.md", "# New brief")
    docs.write("library/brief/v2/logo.svg", "<svg/>")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "lib",
      pass: 1,
      settings: {
        resources: [],
        access: "read" as const,
        items: ["brief"],
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: [
        "nodes/lib/pass-1/files/brief/brief.md",
        "nodes/lib/pass-1/files/brief/logo.svg",
        "nodes/lib/pass-1/text.md",
      ],
    })
    const text = docs.read(`${runDir}/nodes/lib/pass-1/text.md`)?.text
    expect(text).toContain("## Brief (v2)")
    expect(text).toContain("# New brief")
    expect(text).not.toContain("old")
  })

  it("reads a pinned library version into step outputs", async () => {
    const docs = createFakeDocumentStore()
    docs.write(
      `${runDir}/resources.json`,
      JSON.stringify({
        v: 1,
        pins: [
          {
            connection: "demo",
            kind: "item",
            entityId: "alpha",
            revision: "abc",
            title: "Alpha",
          },
        ],
      })
    )
    docs.write(`${runDir}/resources/demo/item/alpha/data.txt`, "alpha-body")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "lib",
      pass: 1,
      settings: {
        resources: [{ connection: "demo", entity: "item", id: "alpha" }],
        access: "read" as const,
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: [
        "nodes/lib/pass-1/files/demo/item/alpha/data.txt",
        "nodes/lib/pass-1/text.md",
      ],
    })
    expect(
      docs.read(`${runDir}/nodes/lib/pass-1/files/demo/item/alpha/data.txt`)
        ?.text
    ).toBe("alpha-body")
    expect(docs.read(`${runDir}/nodes/lib/pass-1/text.md`)?.text).toContain(
      "revision abc"
    )
  })

  it("reads a card asset path through DocumentStore", async () => {
    const docs = createFakeDocumentStore()
    const cardPath = "docket/cards/fix-flaky/assets/acceptance.md"
    docs.write(cardPath, "# Accept\n")
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "a",
      pass: 1,
      settings: {
        resources: [],
        access: "read" as const,
        name: cardPath,
        assetKind: "markdown" as const,
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/a/pass-1/acceptance.md"],
    })
    expect(docs.read(`${runDir}/nodes/a/pass-1/acceptance.md`)?.text).toBe(
      "# Accept\n"
    )
  })

  it("fails with a clear reason when the pinned file is missing", async () => {
    const docs = createFakeDocumentStore()
    docs.write(
      `${runDir}/resources.json`,
      JSON.stringify({
        v: 1,
        pins: [
          {
            connection: "demo",
            kind: "item",
            entityId: "gone",
            revision: "r1",
            title: "Gone",
          },
        ],
      })
    )
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "lib",
      pass: 1,
      settings: {
        resources: [{ connection: "demo", entity: "item", id: "gone" }],
        access: "read" as const,
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: false,
      reason: "exit",
      message: "pinned folder missing: demo/item/gone",
    })
  })

  it("fails when a card asset path is missing", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "a",
      pass: 1,
      settings: {
        resources: [],
        access: "read" as const,
        name: "docket/cards/x/assets/missing.md",
      },
      inputs: [],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: false,
      reason: "exit",
      message: "asset missing: docket/cards/x/assets/missing.md",
    })
  })
})

describe("asset kind (produced)", () => {
  it("writes the input to the named run output", async () => {
    const docs = createFakeDocumentStore()
    const ctx = createStepContext({
      docs,
      runDir,
      nodeId: "rep",
      pass: 1,
      settings: {
        resources: [],
        access: "read" as const,
        name: "test-report.md",
        assetKind: "markdown" as const,
      },
      inputs: [
        {
          from: "sum",
          path: `${runDir}/nodes/sum/pass-1/text.md`,
          name: "text.md",
          text: "## Results\n\nok\n",
        },
      ],
      graph: { id: "wf" },
    })
    const result = await collectExecute(assetKind.execute(ctx))
    expect(result).toEqual({
      ok: true,
      outputs: ["nodes/rep/pass-1/test-report.md"],
    })
    expect(docs.read(`${runDir}/nodes/rep/pass-1/test-report.md`)?.text).toBe(
      "## Results\n\nok\n"
    )
  })
})
