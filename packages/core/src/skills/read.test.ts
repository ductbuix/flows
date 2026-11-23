import {
  skillGetResultSchema,
  skillListResultSchema,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createSkillCatalog } from "./catalog.ts"
import { writeSkillFixture } from "./fixtures.ts"
import { createSkillReadBindings } from "./read.ts"

function skillStack() {
  const workspaceDocs = createFakeDocumentStore()
  writeSkillFixture(workspaceDocs, {
    dir: ".agents",
    slug: "alpha",
    description: "Alpha skill.",
    body: "Alpha body.\n",
  })
  writeSkillFixture(workspaceDocs, {
    dir: ".claude",
    slug: "alpha",
    description: "Alpha skill.",
  })
  writeSkillFixture(workspaceDocs, {
    dir: ".cursor",
    slug: "beta",
    description: "Beta skill.",
    body: "Beta body.\n",
  })
  writeSkillFixture(workspaceDocs, {
    dir: ".claude",
    slug: "broken-skill",
    omitDescription: true,
    body: "TODO\n",
  })
  const bus = new UpdateBus()
  const catalog = createSkillCatalog({
    roots: [
      {
        scope: "workspace",
        docs: workspaceDocs,
        watcher: createFakeFileWatcher(),
      },
    ],
    bus,
  })
  catalog.start()
  return { catalog, dispose: () => catalog.dispose() }
}

function linkedClient(bindings: ReturnType<typeof createSkillReadBindings>) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, bindings, { signal: new AbortController().signal })
  return client
}

describe("skill read FCP", () => {
  it("lists summaries without bodies and returns body on get", async () => {
    const { catalog, dispose } = skillStack()
    const client = linkedClient(createSkillReadBindings({ catalog }))

    const page = skillListResultSchema.parse(
      await client.request("skill/list", { limit: 2 })
    )
    expect(page.items.map((s) => `${s.scope}/${s.slug}`)).toEqual([
      "workspace/alpha",
      "workspace/beta",
    ])
    expect(page.items[0]?.dirs).toEqual([".agents", ".claude"])
    expect(page.items.every((s) => !("body" in s))).toBe(true)
    expect(page.next).toBe("workspace/beta")

    const page2 = skillListResultSchema.parse(
      await client.request("skill/list", {
        cursor: page.next,
        limit: 2,
      })
    )
    expect(page2.items.map((s) => s.slug)).toEqual(["broken-skill"])
    expect(page2.items[0]?.problem).toBe("SKILL.md has no description")
    expect(page2.next).toBeUndefined()

    const detail = skillGetResultSchema.parse(
      await client.request("skill/get", {
        slug: "alpha",
        scope: "workspace",
      })
    )
    expect(detail.body).toContain("Alpha body")
    expect(detail.dirs).toEqual([".agents", ".claude"])
    dispose()
  })

  it("returns not_found for an unknown skill", async () => {
    const { catalog, dispose } = skillStack()
    const client = linkedClient(createSkillReadBindings({ catalog }))
    await expect(
      client.request("skill/get", { slug: "missing", scope: "workspace" })
    ).rejects.toMatchObject({ code: expect.any(Number) })
    dispose()
  })
})
