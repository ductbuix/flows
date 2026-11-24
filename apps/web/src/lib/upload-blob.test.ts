import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FlowsClient } from "@workspace/sdk"
import { uploadBlob } from "./upload-blob"

describe("uploadBlob", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    window.__FLOWS_FCP__ = undefined
  })

  it("PUTs to /blobs with the bootstrap token", async () => {
    window.__FLOWS_FCP__ = {
      url: "ws://127.0.0.1:8787/fcp",
      token: "tok",
    }
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: "b1",
        name: "note.md",
        size: 2,
        mime: "text/markdown",
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    const client = {
      ready: Promise.resolve({
        engineCapabilities: { blobs: { http: "http://127.0.0.1:8787/blobs" } },
      }),
    } as unknown as FlowsClient

    const ref = await uploadBlob(client, {
      scope: "docket/cards/x/assets",
      name: "note.md",
      body: "hi",
      mime: "text/markdown",
    })
    expect(ref.id).toBe("b1")
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain("/blobs?")
    expect(String(url)).toContain("token=tok")
    expect(String(url)).toContain("name=note.md")
    expect(init).toMatchObject({ method: "PUT" })
  })

  it("throws when blobs.http is absent", async () => {
    const client = {
      ready: Promise.resolve({ engineCapabilities: {} }),
    } as unknown as FlowsClient
    await expect(
      uploadBlob(client, { scope: "x", name: "a", body: "b" })
    ).rejects.toThrow(/not available/)
  })
})
