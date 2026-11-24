import { describe, expect, it } from "vitest"
import {
  createFakeDocumentStore,
  createFakeFileWatcher,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createSkillCatalog } from "./catalog.ts"
import { writeSkillFixture } from "./fixtures.ts"

const flush = () => new Promise<void>((resolve) => resolve())

function stack() {
  const workspaceDocs = createFakeDocumentStore()
  const homeDocs = createFakeDocumentStore()
  const workspaceWatcher = createFakeFileWatcher()
  const homeWatcher = createFakeFileWatcher()
  const bus = new UpdateBus()
  const catalog = createSkillCatalog({
    roots: [
      { scope: "workspace", docs: workspaceDocs, watcher: workspaceWatcher },
      { scope: "home", docs: homeDocs, watcher: homeWatcher },
    ],
    bus,
  })
  return {
    workspaceDocs,
    homeDocs,
    workspaceWatcher,
    homeWatcher,
    bus,
    catalog,
  }
}

describe("SkillCatalog", () => {
  it("merges one slug across dirs and scopes separately", () => {
    const { workspaceDocs, homeDocs, catalog } = stack()
    writeSkillFixture(workspaceDocs, {
      dir: ".agents",
      slug: "write-tests",
      description: "Write tests.",
    })
    writeSkillFixture(workspaceDocs, {
      dir: ".claude",
      slug: "write-tests",
      description: "Write tests.",
    })
    writeSkillFixture(homeDocs, {
      dir: ".agents",
      slug: "write-tests",
      description: "Home write tests.",
    })
    writeSkillFixture(workspaceDocs, {
      dir: ".cursor",
      slug: "commit-style",
      description: "Commit style.",
    })
    catalog.start()

    const list = catalog.list()
    expect(list).toHaveLength(3)
    const ws = catalog.get("workspace", "write-tests")!
    expect(ws.dirs).toEqual([".agents", ".claude"])
    expect(ws.description).toBe("Write tests.")
    expect(ws.problem).toBeUndefined()
    expect(catalog.get("home", "write-tests")?.dirs).toEqual([".agents"])
    expect(catalog.get("workspace", "commit-style")?.dirs).toEqual([".cursor"])
    catalog.dispose()
  })

  it("flags a skill without a description with problem", () => {
    const { workspaceDocs, catalog } = stack()
    writeSkillFixture(workspaceDocs, {
      dir: ".claude",
      slug: "broken-skill",
      omitDescription: true,
    })
    catalog.start()

    const broken = catalog.get("workspace", "broken-skill")!
    expect(broken.description).toBe("")
    expect(broken.problem).toBe("SKILL.md has no description")
    catalog.dispose()
  })

  it("publishes skill/update skills_changed on file change", async () => {
    const { workspaceDocs, workspaceWatcher, bus, catalog } = stack()
    const path = writeSkillFixture(workspaceDocs, {
      dir: ".agents",
      slug: "live",
      description: "Before.",
    })
    catalog.start()

    const kinds: string[] = []
    const peer = {
      notify: (_n: string, params: Record<string, unknown>) => {
        kinds.push(String(params.kind))
      },
    }
    bus.subscribe("t1", peer, { topics: ["skill"] })

    workspaceDocs.write(
      path,
      `---\nname: live\ndescription: After edit.\n---\n\nUpdated.\n`
    )
    workspaceWatcher.pulse(path)
    await flush()

    expect(catalog.get("workspace", "live")?.description).toBe("After edit.")
    expect(kinds).toEqual(["skills_changed"])
    catalog.dispose()
  })

  it("drops a skill when its last copy is removed", async () => {
    const { workspaceDocs, workspaceWatcher, catalog } = stack()
    const path = writeSkillFixture(workspaceDocs, {
      dir: ".agents",
      slug: "gone",
      description: "Temp.",
    })
    catalog.start()
    expect(catalog.get("workspace", "gone")).toBeDefined()

    workspaceDocs.remove(path)
    workspaceWatcher.pulse(path)
    await flush()

    expect(catalog.get("workspace", "gone")).toBeUndefined()
    catalog.dispose()
  })
})
