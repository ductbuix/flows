import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import {
  clearConnectors,
  fakeConnector,
  getConnector,
  registerConnector,
} from "./connectors/index.ts"
import { findConnection, resetConnectionLookup } from "./connection-resolve.ts"
import { assertNodePublishValid } from "./nodes/publish-assert.ts"
import {
  advanceWorkCopyBase,
  diffWorkCopy,
  workConnectionDir,
} from "./work-copy.ts"

const homes: string[] = []

afterEach(() => {
  resetConnectionLookup()
  clearConnectors()
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

beforeEach(() => {
  registerConnector(fakeConnector)
})

function writeConnector(
  home: string,
  id: string,
  opts: { write?: boolean; providerId?: string } = {}
): void {
  mkdirSync(join(home, "connectors"), { recursive: true })
  const caps =
    opts.write === false
      ? "capabilities: []"
      : `capabilities:
  - name: publish
    write: true
    allowed: true`
  writeFileSync(
    join(home, "connectors", `${id}.yaml`),
    [
      `id: ${id}`,
      "name: Demo",
      "transport: api",
      "how: https://example.test",
      "auth: pat",
      `providerId: ${opts.providerId ?? "fake"}`,
      caps,
      "",
    ].join("\n")
  )
}

function publishGraph(connectionId: string) {
  return workflowSchema.parse({
    id: "wf-pub",
    nodes: [
      { id: "start", kind: "trigger", type: "manual" },
      {
        id: "lib",
        kind: "asset",
        access: "propose",
        resources: [
          { connection: connectionId, entity: "item", id: "alpha" },
        ],
      },
      {
        id: "edit",
        kind: "command",
        run: "echo changed",
      },
      {
        id: "ship",
        kind: "output",
        target: "publish",
        connection: connectionId,
      },
    ],
    edges: [
      { from: "start", to: "edit" },
      { from: "lib", to: "edit" },
      { from: "edit", to: "ship" },
    ],
  })
}

describe("connection resolve via v2 connectors (BL-215)", () => {
  it("maps connectors/<id>.yaml to a Connection for publish policy", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-conn-"))
    homes.push(home)
    writeConnector(home, "pub-demo")

    const conn = findConnection(home, "pub-demo")
    expect(conn).toMatchObject({
      id: "pub-demo",
      connector: "fake",
      policy: "approve-each-publish",
    })
    expect(findConnection(home, "missing")).toBeUndefined()
  })

  it("treats connectors without write as read-only", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-conn-ro-"))
    homes.push(home)
    writeConnector(home, "ro-demo", { write: false })
    expect(findConnection(home, "ro-demo")?.policy).toBe("read-only")
  })

  it("publishes a work copy when the node connection is a connector file", async () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-conn-pub-"))
    homes.push(home)
    writeConnector(home, "pub-demo")
    const graph = publishGraph("pub-demo")

    expect(() => assertNodePublishValid(home, graph)).not.toThrow()

    const runRoot = join(home, "workflows", "wf-pub", "runs", "r1")
    mkdirSync(runRoot, { recursive: true })
    const work = workConnectionDir(runRoot, "pub-demo")
    mkdirSync(work, { recursive: true })
    writeFileSync(join(work, "note.txt"), "hello\n")

    const { changeSet } = await diffWorkCopy({
      home,
      runRoot,
      connectionId: "pub-demo",
      publishTaskId: "ship",
      runId: "r1",
    })
    expect(changeSet.ops.length).toBeGreaterThan(0)

    const conn = findConnection(home, "pub-demo")
    expect(conn).toBeDefined()
    const connector = getConnector(conn!.connector)
    expect(connector).toBeDefined()
    const applied = await connector!.publish(conn!, changeSet, home, {
      runRoot,
    })
    expect(applied.status).toBe("applied")
    advanceWorkCopyBase(runRoot, "pub-demo")
  })
})
