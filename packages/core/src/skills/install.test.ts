import {
  ErrorCode,
  skillGetResultSchema,
  skillInstallResultSchema,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createSkillCatalog } from "./catalog.ts"
import { writeSkillFixture } from "./fixtures.ts"
import {
  createFakeSkillSources,
  createSkillInstallBindings,
  installSkill,
  uninstallSkill,
} from "./install.ts"
import { createSkillReadBindings } from "./read.ts"

function stack() {
  const workspaceDocs = createFakeDocumentStore()
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
  const sources = createFakeSkillSources([
    {
      sourceId: "repo-team-skills",
      version: 1,
      skill: {
        slug: "write-tests",
        name: "write-tests",
        description: "Write focused unit tests.",
        body: "Read the diff first.\n",
      },
    },
  ])
  const deps = { workspaceDocs, catalog, bus, sources }
  return { ...deps, dispose: () => catalog.dispose() }
}

function linkedClient(
  bindings: ReturnType<typeof createSkillInstallBindings> &
    ReturnType<typeof createSkillReadBindings>
) {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, bindings, { signal: new AbortController().signal })
  return client
}

describe("skill install", () => {
  it("copies into .agents and .claude and records from", () => {
    const { dispose, ...deps } = stack()
    const result = installSkill(deps, {
      sourceId: "repo-team-skills",
      slug: "write-tests",
      version: 1,
    })
    expect("skill" in result).toBe(true)
    if (!("skill" in result)) return
    expect(result.skill.dirs).toEqual([".agents", ".claude"])
    expect(result.skill.from).toEqual({
      sourceId: "repo-team-skills",
      version: 1,
    })
    expect(
      deps.workspaceDocs.read(".agents/skills/write-tests/SKILL.md")
    ).toBeTruthy()
    expect(
      deps.workspaceDocs.read(".claude/skills/write-tests/SKILL.md")
    ).toBeTruthy()
    dispose()
  })

  it("returns conflict when the slug already exists", () => {
    const { dispose, ...deps } = stack()
    writeSkillFixture(deps.workspaceDocs, {
      dir: ".cursor",
      slug: "write-tests",
      description: "Local copy.",
    })
    deps.catalog.rebuild()

    const result = installSkill(deps, {
      sourceId: "repo-team-skills",
      slug: "write-tests",
      version: 1,
    })
    expect("conflict" in result).toBe(true)
    if (!("conflict" in result)) return
    expect(result.conflict.dirs).toEqual([".cursor"])
    expect(
      deps.workspaceDocs.read(".agents/skills/write-tests/SKILL.md")
    ).toBeNull()
    dispose()
  })

  it("uninstall removes installed copies only", () => {
    const { dispose, ...deps } = stack()
    installSkill(deps, {
      sourceId: "repo-team-skills",
      slug: "write-tests",
      version: 1,
    })
    uninstallSkill(deps, "write-tests")
    expect(deps.catalog.get("workspace", "write-tests")).toBeUndefined()
    expect(
      deps.workspaceDocs.read(".agents/skills/write-tests/SKILL.md")
    ).toBeNull()
    dispose()
  })

  it("exposes install and uninstall over FCP with conflict", async () => {
    const { dispose, ...deps } = stack()
    const client = linkedClient({
      ...createSkillReadBindings({ catalog: deps.catalog }),
      ...createSkillInstallBindings(deps),
    })

    const installed = skillInstallResultSchema.parse(
      await client.request("skill/install", {
        sourceId: "repo-team-skills",
        slug: "write-tests",
        version: 1,
      })
    )
    expect(installed.skill.from).toEqual({
      sourceId: "repo-team-skills",
      version: 1,
    })

    const got = skillGetResultSchema.parse(
      await client.request("skill/get", {
        slug: "write-tests",
        scope: "workspace",
      })
    )
    expect(got.from).toEqual(installed.skill.from)

    try {
      await client.request("skill/install", {
        sourceId: "repo-team-skills",
        slug: "write-tests",
        version: 1,
      })
      expect.unreachable("expected conflict")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      if (err instanceof JsonRpcResponseError) {
        expect(err.code).toBe(ErrorCode.conflict)
        expect(err.data).toMatchObject({ code: "conflict" })
      }
    }

    await client.request("skill/uninstall", { slug: "write-tests" })
    expect(deps.catalog.get("workspace", "write-tests")).toBeUndefined()
    dispose()
  })
})
