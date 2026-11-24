import { randomBytes } from "node:crypto"
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { BlobPutMeta, BlobRef, BlobStore } from "@workspace/core/ports"

type BlobMetaFile = {
  id: string
  scope: string
  name: string
  mime: string
  size: number
}

function metaPath(root: string, id: string): string {
  return join(root, "meta", `${id}.json`)
}

function dataPath(root: string, id: string): string {
  return join(root, "data", id)
}

async function writeStreamToFile(
  stream: ReadableStream<Uint8Array>,
  dest: string
): Promise<number> {
  mkdirSync(dirname(dest), { recursive: true })
  const tmp = `${dest}.${randomBytes(4).toString("hex")}.tmp`
  const nodeReadable = Readable.fromWeb(
    stream as import("node:stream/web").ReadableStream
  )
  try {
    await pipeline(nodeReadable, createWriteStream(tmp))
    const size = statSync(tmp).size
    renameSync(tmp, dest)
    return size
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    throw err
  }
}

export function createNodeBlobStore(options: { root: string }): BlobStore {
  const root = options.root
  mkdirSync(join(root, "meta"), { recursive: true })
  mkdirSync(join(root, "data"), { recursive: true })

  return {
    async put(
      scope: string,
      stream: ReadableStream<Uint8Array>,
      meta?: BlobPutMeta
    ): Promise<BlobRef> {
      if (!scope) throw new Error("blob scope required")
      const id = `b_${randomBytes(16).toString("hex")}`
      const size = await writeStreamToFile(stream, dataPath(root, id))
      const name = meta?.name ?? id
      const mime = meta?.mime ?? "application/octet-stream"
      const record: BlobMetaFile = { id, scope, name, mime, size }
      writeFileSync(metaPath(root, id), JSON.stringify(record), "utf8")
      return { id, name, size, mime }
    },

    async open(id: string): Promise<ReadableStream<Uint8Array> | null> {
      if (!id || id.includes("/") || id.includes("..")) return null
      const metaFile = metaPath(root, id)
      const file = dataPath(root, id)
      if (!existsSync(metaFile) || !existsSync(file)) return null
      return Readable.toWeb(
        createReadStream(file)
      ) as ReadableStream<Uint8Array>
    },
  }
}
