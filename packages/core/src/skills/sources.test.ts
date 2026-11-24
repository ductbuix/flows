import { LibItemId } from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { writeItemDisk, writeVersion } from "../library/versions.ts"
import { bindEngine } from "../rpc/bind.ts"
import { createFakeDocumentStore } from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import {
  createLibrarySkillSourceReader,
  createSkillSourcesBindings,
  listOffers,
  readSourceIds,
  saveSources,
} from "./sources.ts"

const ITEM = LibItemId.parse("repo-team-skills")

function seedLibrary(
  docs: ReturnType<typeof createFakeDocumentStore>,
  version: number,
  skills: Record<string, string>
) {
  writeItemDisk(docs, {
    id: ITEM,
    kind: "repo",
    title: "team/skills",
    source: "github",
    remoteId: "team/skills",
    remoteUrl: "https://github.com/team/skills",
    tags: ["repo:team/skills"],
    current: version,
  })
  const files: Record<string, string> = {}
  for (const [slug, body] of Object.entries(skills)) {
    files[`skills/${slug}/SKILL.md`] =
      `---\nname: ${slug}\ndescription: ${slug} desc\n---\n\n${body}\n`
  }
  writeVersion(
    docs,
    ITEM,
    {
      n: version,
      at: "2026-11-24T00:00:00.000Z",
      note: `v${version}`,
      contentHash: `hash-v${version}`,
    },
    files
  )
}

describe("skill sources", () => {
  it("saves source ids and lists offers from the current version", () => {
    const docs = createFakeDocumentStore()
    const bus = new UpdateBus()
    seedLibrary(docs, 1, { "write-tests": "Read the diff." })
    expect(saveSources({ docs, bus }, [ITEM])).toEqual([ITEM])
    expect(readSourceIds(docs)).toEqual([ITEM])
    const offers = listOffers(docs, ITEM)
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      slug: "write-tests",
      name: "write-tests",
      description: "write-tests desc",
    })
    expect(offers[0]!.body).toContain("Read the diff.")
  })

  it("library reader returns a skill at a pinned version", () => {
    const docs = createFakeDocumentStore()
    seedLibrary(docs, 2, { "write-tests": "v2 body" })
    writeVersion(
      docs,
      ITEM,
      {
        n: 1,
        at: "2026-11-20T00:00:00.000Z",
        note: "v1",
        contentHash: "hash-v1",
      },
      {
        "skills/write-tests/SKILL.md":
          "---\nname: write-tests\ndescription: old\n---\n\nv1 body\n",
      }
    )
    const reader = createLibrarySkillSourceReader(docs)
    expect(reader.getSkill(ITEM, 1, "write-tests")?.body).toContain("v1 body")
    expect(reader.getSkill(ITEM, 2, "write-tests")?.body).toContain("v2 body")
    expect(reader.getSkill(ITEM, 2, "missing")).toBeNull()
  })

  it("binds list_sources and save over FCP", async () => {
    const docs = createFakeDocumentStore()
    const bus = new UpdateBus()
    seedLibrary(docs, 1, { review: "Review changes." })
    const [serverT, clientT] = createLinkedTransports()
    const server = new RpcPeer(serverT)
    const client = new RpcPeer(clientT)
    bindEngine(server, createSkillSourcesBindings({ docs, bus }), {
      signal: new AbortController().signal,
    })
    await client.request("skill/save", { sources: [ITEM] })
    const listed = (await client.request("skill/list_sources", {})) as {
      items: { id: string; skills: { slug: string; body: string }[] }[]
    }
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]!.id).toBe(ITEM)
    expect(listed.items[0]!.skills[0]).toMatchObject({
      slug: "review",
      name: "review",
      description: "review desc",
    })
    expect(listed.items[0]!.skills[0]!.body).toContain("Review changes.")
  })
})
