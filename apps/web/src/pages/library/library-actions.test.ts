import { describe, expect, it, vi } from "vitest"
import { pinVersion, pullItem, removeItem } from "./library-actions"

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

  it("starts a pull job", async () => {
    const client = clientWith(async () => ({ jobId: "job_1" }))
    const result = await pullItem(client, "github-acme-demo")
    expect(result).toEqual({ ok: true, jobId: "job_1" })
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
