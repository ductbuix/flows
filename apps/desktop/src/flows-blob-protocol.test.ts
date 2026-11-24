import { describe, expect, it } from "vitest"
import { createFakeBlobStore } from "@workspace/core/testing"
import { flowsBlobResponse, parseFlowsBlobId } from "./flows-blob-protocol.ts"

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

async function readBody(res: Response): Promise<string> {
  return new TextDecoder().decode(await res.arrayBuffer())
}

describe("parseFlowsBlobId", () => {
  it("reads the id from flows-blob://{id}", () => {
    expect(parseFlowsBlobId("flows-blob://b_abc")).toBe("b_abc")
    expect(parseFlowsBlobId("flows-blob://b_abc/")).toBe("b_abc")
  })

  it("rejects empty, path-like, and traversal ids", () => {
    expect(parseFlowsBlobId("flows-blob://")).toBeNull()
    expect(parseFlowsBlobId("flows-blob:///")).toBeNull()
    expect(parseFlowsBlobId("flows-blob://b_a/b")).toBeNull()
    expect(parseFlowsBlobId("flows-blob://../etc")).toBeNull()
    expect(parseFlowsBlobId("https://b_abc")).toBeNull()
  })
})

describe("flowsBlobResponse", () => {
  it("returns 404 for unknown ids", async () => {
    const store = createFakeBlobStore()
    const res = await flowsBlobResponse("flows-blob://missing", store)
    expect(res.status).toBe(404)
  })

  it("returns 404 for out-of-scope ids", async () => {
    const store = createFakeBlobStore()
    await store.put("card", streamOf("x"), { name: "x" })
    const res = await flowsBlobResponse("flows-blob://a/../../x", store)
    expect(res.status).toBe(404)
  })

  it("streams a known blob body", async () => {
    const store = createFakeBlobStore()
    const ref = await store.put("card", streamOf("hello"), {
      name: "a.png",
      mime: "image/png",
    })
    const res = await flowsBlobResponse(`flows-blob://${ref.id}`, store)
    expect(res.status).toBe(200)
    expect(await readBody(res)).toBe("hello")
  })
})
