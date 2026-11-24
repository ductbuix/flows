import type { BlobPutMeta, BlobRef, BlobStore } from "../ports/blob-store.ts"

type Entry = {
  scope: string
  name: string
  mime: string
  bytes: Uint8Array
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

export function createFakeBlobStore(): BlobStore {
  return new FakeBlobStore()
}

class FakeBlobStore implements BlobStore {
  private next = 0
  private readonly entries = new Map<string, Entry>()

  async put(
    scope: string,
    stream: ReadableStream<Uint8Array>,
    meta?: BlobPutMeta
  ): Promise<BlobRef> {
    if (!scope) throw new Error("blob scope required")
    const bytes = await readAll(stream)
    const id = `blob_${this.next++}`
    const name = meta?.name ?? id
    const mime = meta?.mime ?? "application/octet-stream"
    this.entries.set(id, { scope, name, mime, bytes })
    return { id, name, size: bytes.byteLength, mime }
  }

  async open(id: string): Promise<ReadableStream<Uint8Array> | null> {
    const entry = this.entries.get(id)
    if (!entry) return null
    const copy = entry.bytes.slice()
    return new ReadableStream({
      start(controller) {
        controller.enqueue(copy)
        controller.close()
      },
    })
  }
}
