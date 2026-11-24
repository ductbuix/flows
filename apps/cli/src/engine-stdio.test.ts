import { createHost } from "@workspace/adapters-node"
import { createClient } from "@workspace/sdk"
import { ndjsonTransport } from "@workspace/protocol/node"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { afterEach, describe, expect, it } from "vitest"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

describe("flows engine --stdio", () => {
  it("serves FCP over ndjson streams", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-stdio-"))
    homes.push(home)
    mkdirSync(join(home, "workflows", "demo"), { recursive: true })
    writeFileSync(
      join(home, "workflows", "demo", "workflow.yaml"),
      `id: demo
nodes:
  - { id: t, kind: trigger, type: manual }
  - { id: a, kind: command, run: "true" }
edges:
  - { from: t, to: a }
`
    )

    const engine = createHost({ home })
    const host = createFcpHost(engine)
    const toHost = new PassThrough()
    const fromHost = new PassThrough()
    bindFcpTransport(ndjsonTransport(toHost, fromHost), engine, host)

    const client = createClient({
      transport: ndjsonTransport(fromHost, toHost),
      clientInfo: { name: "stdio-test", version: "0.0.0" },
    })
    await client.ready
    const listed = await client.call("inbox/list", {})
    expect(listed.items).toEqual([])
    client.close()
    host.dispose()
    engine.close()
  })
})
