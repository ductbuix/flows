import { describe, expect, it, vi } from "vitest"
import {
  addFromDisk,
  addFromLink,
  pinVersion,
  pullItem,
  pushItem,
  removeItem,
  setTags,
  unlinkItem,
} from "./library-actions"

function clientWith(
  impl: (method: string, params: unknown) => Promise<unknown>
) {
  return { call: vi.fn(impl) } as unknown as Parameters<typeof pinVersion>[0]
}

describe("library-actions", () => {
  it("pins a version", async () => {
    const item = { id: "github-acme-demo", current: 1 }
    const client = clientWith(async () => item)
    const result = await pinVersion(client, "github-acme-demo", 1)
    expect(result).toEqual(item)
    expect(client.call).toHaveBeenCalledWith(
      "library/pin_version",
      expect.objectContaining({ id: "github-acme-demo", n: 1 })
    )
  })

  it("starts pull and push jobs", async () => {
    const client = clientWith(async () => ({ jobId: "job_1" }))
    expect(await pullItem(client, "github-acme-demo")).toEqual({
      ok: true,
      jobId: "job_1",
    })
    expect(await pushItem(client, "github-acme-demo")).toEqual({
      ok: true,
      jobId: "job_1",
    })
  })

  it("sets tags and unlinks", async () => {
    const item = { id: "github-acme-demo", tags: ["a:b"], source: "local" }
    const client = clientWith(async () => item)
    expect(await setTags(client, "github-acme-demo", ["a:b"])).toEqual(item)
    expect(await unlinkItem(client, "github-acme-demo")).toEqual(item)
  })

  it("adds from link then pulls", async () => {
    const client = clientWith(async (method) => {
      if (method === "library/add") return { id: "github-acme-new" }
      if (method === "library/pull") return { jobId: "job_9" }
      return {}
    })
    expect(await addFromLink(client, "https://github.com/acme/new")).toEqual({
      ok: true,
      id: "github-acme-new",
      jobId: "job_9",
    })
  })

  it("adds from disk", async () => {
    const client = clientWith(async () => ({ id: "brand-guidelines" }))
    expect(
      await addFromDisk(client, {
        title: "Brand guidelines",
        itemKind: "other",
        tags: ["type:design"],
        files: { "a.md": "hi" },
      })
    ).toEqual({ ok: true, id: "brand-guidelines" })
  })

  it("removes an item", async () => {
    const client = clientWith(async () => ({}))
    expect(await removeItem(client, "github-acme-demo")).toBe("ok")
  })

  it("maps call failures to messages", async () => {
    const client = clientWith(async () => {
      throw new Error("boom")
    })
    expect(await removeItem(client, "x")).toBe("boom")
    expect(await pullItem(client, "x")).toEqual({ ok: false, error: "boom" })
  })
})
