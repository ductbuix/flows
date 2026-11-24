import { beforeEach, describe, expect, it } from "vitest"
import type { BlobStore } from "../ports/blob-store.ts"

export type BlobStoreFactory = () => BlobStore

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function streamOf(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
}

async function readAll(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

export function describeBlobStoreContract(
  title: string,
  factories: ReadonlyArray<readonly [string, BlobStoreFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, createStore) => {
    let store: BlobStore

    beforeEach(() => {
      store = createStore()
    })

    it("open missing id returns null", async () => {
      expect(await store.open("no-such-blob")).toBeNull()
    })

    it("put then open round-trips bytes and BlobRef fields", async () => {
      const data = bytesOf("hello blob\n")
      const ref = await store.put("run/r1", streamOf(data), {
        name: "out.txt",
        mime: "text/plain",
      })
      expect(ref.name).toBe("out.txt")
      expect(ref.mime).toBe("text/plain")
      expect(ref.size).toBe(data.byteLength)
      expect(ref.id.length).toBeGreaterThan(0)

      const opened = await store.open(ref.id)
      expect(opened).not.toBeNull()
      expect(await readAll(opened!)).toEqual(data)
    })

    it("defaults name and mime when meta omitted", async () => {
      const ref = await store.put("card/c1", streamOf(bytesOf("x")))
      expect(ref.size).toBe(1)
      expect(ref.mime).toBe("application/octet-stream")
      expect(ref.name.length).toBeGreaterThan(0)
    })

    it("scopes keep distinct ids for the same name", async () => {
      const a = await store.put("run/a", streamOf(bytesOf("1")), {
        name: "same.bin",
      })
      const b = await store.put("run/b", streamOf(bytesOf("2")), {
        name: "same.bin",
      })
      expect(a.id).not.toBe(b.id)
      expect(await readAll((await store.open(a.id))!)).toEqual(bytesOf("1"))
      expect(await readAll((await store.open(b.id))!)).toEqual(bytesOf("2"))
    })
  })
}
