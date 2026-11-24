import {
  ErrorCode,
  fileListResultSchema,
  fileReadTextResultSchema,
  fileStatResultSchema,
  fileWriteTextResultSchema,
} from "@workspace/contracts"
import {
  createLinkedTransports,
  JsonRpcResponseError,
  RpcPeer,
} from "@workspace/protocol"
import { describe, expect, it, vi } from "vitest"
import { bindEngine } from "../rpc/bind.ts"
import { createFakeDocumentStore } from "../testing/index.ts"
import { createFileBindings } from "./service.ts"

function linkedClient(
  bindings: ReturnType<typeof createFileBindings>
): RpcPeer {
  const [serverTransport, clientTransport] = createLinkedTransports()
  const server = new RpcPeer(serverTransport)
  const client = new RpcPeer(clientTransport)
  bindEngine(server, bindings, { signal: new AbortController().signal })
  return client
}

function seedDocs() {
  const docs = createFakeDocumentStore()
  docs.write("docket/board.yaml", "version: 1\n")
  docs.write("workflows/demo/workflow.yaml", "id: demo\n")
  docs.write("workflows/demo/nodes/plan.md", "# plan\n")
  docs.write("secrets/token", "secret\n")
  return docs
}

describe("file FCP", () => {
  it("lists, stats, reads and writes under allowed roots", async () => {
    const docs = seedDocs()
    const client = linkedClient(
      createFileBindings({ docs, allowedRoots: [""] })
    )

    const listed = fileListResultSchema.parse(
      await client.request("file/list", { path: "workflows" })
    )
    expect(listed.items.map((e) => e.path)).toEqual([
      "workflows/demo",
      "workflows/demo/nodes",
      "workflows/demo/nodes/plan.md",
      "workflows/demo/workflow.yaml",
    ])
    expect(listed.items.find((e) => e.path === "workflows/demo")?.kind).toBe(
      "dir"
    )
    expect(
      listed.items.find((e) => e.path === "workflows/demo/nodes")?.kind
    ).toBe("dir")

    const st = fileStatResultSchema.parse(
      await client.request("file/stat", {
        path: "workflows/demo/workflow.yaml",
      })
    )
    expect(st.kind).toBe("file")
    expect(st.hash).toBeTruthy()

    const read = fileReadTextResultSchema.parse(
      await client.request("file/read_text", {
        path: "workflows/demo/nodes/plan.md",
      })
    )
    expect(read.text).toBe("# plan\n")

    const written = fileWriteTextResultSchema.parse(
      await client.request("file/write_text", {
        path: "workflows/demo/nodes/plan.md",
        text: "# next\n",
        baseHash: read.hash,
      })
    )
    expect(docs.read("workflows/demo/nodes/plan.md")?.text).toBe("# next\n")
    expect(written.hash).toBeTruthy()
  })

  it("returns policy_denied for .. escape and paths outside roots", async () => {
    const docs = seedDocs()
    const client = linkedClient(
      createFileBindings({ docs, allowedRoots: ["workflows"] })
    )

    for (const path of [
      "../secrets/token",
      "workflows/../../secrets/token",
      "secrets/token",
      "/../etc/passwd",
    ]) {
      try {
        await client.request("file/read_text", { path })
        expect.unreachable(`expected policy_denied for ${path}`)
      } catch (err) {
        expect(err).toBeInstanceOf(JsonRpcResponseError)
        const rpcErr = err as JsonRpcResponseError
        expect(rpcErr.code).toBe(ErrorCode.policy_denied)
        expect(rpcErr.data).toMatchObject({ code: "policy_denied" })
      }
    }

    for (const method of [
      "file/list",
      "file/stat",
      "file/write_text",
      "file/reveal",
    ] as const) {
      const params =
        method === "file/list"
          ? { path: "../secrets" }
          : method === "file/write_text"
            ? { path: "../secrets/x", text: "x" }
            : { path: "../secrets/token" }
      try {
        await client.request(method, params)
        expect.unreachable(`expected policy_denied for ${method}`)
      } catch (err) {
        expect((err as JsonRpcResponseError).data).toMatchObject({
          code: "policy_denied",
        })
      }
    }
  })

  it("reveal calls the host hook after confinement", async () => {
    const docs = seedDocs()
    const reveal = vi.fn()
    const client = linkedClient(
      createFileBindings({ docs, allowedRoots: [""], reveal })
    )
    await client.request("file/reveal", { path: "docket/board.yaml" })
    expect(reveal).toHaveBeenCalledWith("docket/board.yaml")
  })

  it("write_text returns conflict with current disk copy", async () => {
    const docs = seedDocs()
    const client = linkedClient(
      createFileBindings({ docs, allowedRoots: [""] })
    )
    try {
      await client.request("file/write_text", {
        path: "docket/board.yaml",
        text: "stale\n",
        baseHash: "not-the-hash",
      })
      expect.unreachable("expected conflict")
    } catch (err) {
      expect(err).toBeInstanceOf(JsonRpcResponseError)
      expect((err as JsonRpcResponseError).data).toMatchObject({
        code: "conflict",
        current: { path: "docket/board.yaml", text: "version: 1\n" },
      })
    }
  })
})
