import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createFakeBlobStore } from "@workspace/core/testing"
import { createApp } from "./app.ts"
import { createEngine, setBlobStore } from "@workspace/engine"

const temps: string[] = []
const TOKEN = "blob-test-token"

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

describe("GET/PUT /blobs", () => {
  let app: ReturnType<typeof createApp>
  let store: ReturnType<typeof createFakeBlobStore>

  beforeEach(() => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-blob-route-"))
    temps.push(home)
    store = createFakeBlobStore()
    const engine = createEngine({ home })
    setBlobStore(store)
    app = createApp({ engine, fcpToken: TOKEN, port: 8787 })
  })

  it("rejects PUT without the lock token", async () => {
    const res = await app.request("/blobs?scope=run/r1", {
      method: "PUT",
      body: "hi",
    })
    expect(res.status).toBe(400)
  })

  it("rejects PUT with a wrong token", async () => {
    const res = await app.request("/blobs?scope=run/r1&token=wrong", {
      method: "PUT",
      body: "hi",
    })
    expect(res.status).toBe(401)
  })

  it("PUT then GET round-trips bytes with the lock token", async () => {
    const put = await app.request(
      `/blobs?scope=run/r1&token=${TOKEN}&name=note.txt`,
      {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: "hello blobs",
      }
    )
    expect(put.status).toBe(200)
    const ref = (await put.json()) as {
      id: string
      name: string
      size: number
      mime: string
    }
    expect(ref).toMatchObject({
      name: "note.txt",
      mime: "text/plain",
      size: 11,
    })

    const get = await app.request(`/blobs/${ref.id}?token=${TOKEN}`)
    expect(get.status).toBe(200)
    expect(await get.text()).toBe("hello blobs")
  })

  it("GET missing blob returns 404", async () => {
    const res = await app.request(`/blobs/nope?token=${TOKEN}`)
    expect(res.status).toBe(404)
  })
})
