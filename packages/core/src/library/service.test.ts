import {
  LibItemId,
  connectorToYaml,
  libItemToYaml,
  type ConnectorFile,
  type LibItemDisk,
} from "@workspace/contracts"
import { createLinkedTransports, RpcPeer } from "@workspace/protocol"
import { describe, expect, it } from "vitest"
import { createConnectorRuntime } from "../connectors/runtime.ts"
import { createCliTransport } from "../connectors/cli-transport.ts"
import { createConnectorTransportRegistry } from "../connectors/registry.ts"
import { connectorPath, createConnectorService } from "../connectors/service.ts"
import { bindEngine } from "../rpc/bind.ts"
import {
  createFakeClock,
  createFakeDocumentStore,
  createFakeIds,
  createFakeProcessRunner,
} from "../testing/index.ts"
import { UpdateBus } from "../updates/update-bus.ts"
import { createLibraryBindings } from "./bind.ts"
import { createConnectorLibraryFetcher, type LibraryFetcher } from "./fetch.ts"
import { createProviderService } from "./providers.ts"
import { createLibraryService } from "./service.ts"
import { itemYamlPath, nextCurrent, writeItemDisk } from "./versions.ts"

const ITEM_ID = LibItemId.parse("github-acme-demo")

function seedItem(
  docs: ReturnType<typeof createFakeDocumentStore>,
  overrides: Partial<LibItemDisk> = {}
): LibItemDisk {
  const item: LibItemDisk = {
    id: ITEM_ID,
    kind: "repo",
    title: "GitHub acme/demo",
    source: "github",
    remoteId: "acme/demo",
    remoteUrl: "https://github.com/acme/demo",
    tags: ["repo:acme/demo"],
    current: 1,
    ...overrides,
  }
  docs.write(itemYamlPath(item.id), libItemToYaml(item))
  return item
}

function fakeFetcher(
  sequence: Array<{ files: Record<string, string>; note?: string }>
): LibraryFetcher {
  let i = 0
  return {
    async fetch() {
      const next = sequence[i] ?? sequence[sequence.length - 1]
      i += 1
      if (!next) throw new Error("no fetch fixture")
      return next
    },
  }
}

function stack(fetcher: LibraryFetcher) {
  const docs = createFakeDocumentStore()
  const bus = new UpdateBus()
  const ids = createFakeIds()
  const clock = createFakeClock(1_700_000_000_000)
  const providers = createProviderService({ docs })
  const library = createLibraryService({ docs, bus, ids, clock, fetcher })
  seedItem(docs)
  return { docs, bus, ids, clock, providers, library }
}

describe("nextCurrent", () => {
  it("starts at the first version and follows newest unless pinned older", () => {
    expect(nextCurrent(1, 0, 1)).toBe(1)
    expect(nextCurrent(1, 1, 2)).toBe(2)
    expect(nextCurrent(1, 2, 3)).toBe(1)
    expect(nextCurrent(3, 3, 4)).toBe(4)
  })
})

describe("LibraryService pull versions", () => {
  it("writes v1 on first pull and advances current with content changes", async () => {
    const { library } = stack(
      fakeFetcher([
        { files: { "README.md": "one" }, note: "First fetch" },
        { files: { "README.md": "two" }, note: "Updated" },
      ])
    )

    const { jobId } = library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    const afterFirst = library.get(ITEM_ID)!
    expect(jobId).toBe("job_0")
    expect(afterFirst.versions.map((v) => v.n)).toEqual([1])
    expect(afterFirst.current).toBe(1)
    expect(afterFirst.versions[0]?.note).toBe("First fetch")

    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    const afterSecond = library.get(ITEM_ID)!
    expect(afterSecond.versions.map((v) => v.n)).toEqual([2, 1])
    expect(afterSecond.current).toBe(2)
  })

  it("does not create a version when content is unchanged", async () => {
    const { library } = stack(
      fakeFetcher([
        { files: { "page.md": "same" } },
        { files: { "page.md": "same" } },
      ])
    )

    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()

    const item = library.get(ITEM_ID)!
    expect(item.versions).toHaveLength(1)
    expect(item.current).toBe(1)
  })

  it("keeps current when pinned to an older version", async () => {
    const { library } = stack(
      fakeFetcher([
        { files: { a: "1" } },
        { files: { a: "2" } },
        { files: { a: "3" } },
      ])
    )

    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    expect(library.get(ITEM_ID)!.current).toBe(2)

    library.pinVersion(ITEM_ID, 1)
    expect(library.get(ITEM_ID)!.current).toBe(1)

    library.pull(ITEM_ID, new AbortController().signal)
    await library.flush()
    const item = library.get(ITEM_ID)!
    expect(item.versions.map((v) => v.n)).toEqual([3, 2, 1])
    expect(item.current).toBe(1)
  })

  it("pulls through ConnectorRuntime and emits library/update kinds", async () => {
    const docs = createFakeDocumentStore()
    const bus = new UpdateBus()
    const updates: Array<{ kind: string }> = []
    const peer = {
      notify(_method: string, params: unknown) {
        updates.push(params as { kind: string })
      },
    }
    bus.subscribe("t", peer, { topics: ["library"] })

    const github: ConnectorFile = {
      id: "github-cli",
      name: "GitHub",
      transport: "cli",
      how: "gh-stub",
      auth: "cli-login",
      providerId: "github",
      capabilities: [
        {
          name: "repo clone",
          desc: "Read repositories",
          write: false,
          allowed: true,
          cmd: ["repo", "clone"],
        },
      ],
    }
    docs.write(connectorPath(github.id), connectorToYaml(github))
    seedItem(docs)

    const connectors = createConnectorService({ docs })
    const runner = createFakeProcessRunner()
    runner.on("gh-stub", () => ({
      stdout: JSON.stringify({
        files: { "README.md": "from-cli" },
        note: "clone",
      }),
      exitCode: 0,
    }))
    const runtime = createConnectorRuntime({
      connectors,
      transports: createConnectorTransportRegistry([
        createCliTransport(runner),
      ]),
    })
    const providers = createProviderService({ docs })
    const library = createLibraryService({
      docs,
      bus,
      ids: createFakeIds(),
      clock: createFakeClock(1_700_000_000_000),
      fetcher: createConnectorLibraryFetcher({
        connectors,
        runtime,
        providers,
      }),
    })

    const [serverTransport, clientTransport] = createLinkedTransports()
    const server = new RpcPeer(serverTransport)
    const client = new RpcPeer(clientTransport)
    bindEngine(server, createLibraryBindings(providers, library), {
      signal: new AbortController().signal,
    })

    const result = (await client.request("library/pull", { id: ITEM_ID })) as {
      jobId: string
    }
    await library.flush()
    expect(result.jobId).toBe("job_0")
    expect(library.get(ITEM_ID)?.versions[0]?.note).toBe("clone")
    expect(updates.map((u) => u.kind)).toEqual([
      "job_progress",
      "item_changed",
      "job_finished",
    ])

    const listed = (await client.request("library/list", {})) as {
      items: LibItemDisk[]
    }
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]?.id).toBe(ITEM_ID)
  })
})

describe("writeItemDisk helper", () => {
  it("round-trips an item seed", () => {
    const docs = createFakeDocumentStore()
    writeItemDisk(docs, {
      id: ITEM_ID,
      kind: "web",
      title: "Page",
      source: "local",
      tags: [],
      current: 1,
    })
    expect(docs.read(itemYamlPath(ITEM_ID))?.text).toContain("title: Page")
  })
})
