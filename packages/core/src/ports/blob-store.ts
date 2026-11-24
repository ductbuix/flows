/** Opaque blob handle returned by put (DES-040, DES-041). */
export type BlobRef = {
  id: string
  name: string
  size: number
  mime: string
}

export type BlobPutMeta = {
  name?: string
  mime?: string
}

/**
 * Binary / large file store. Ids are opaque and scoped (card asset, run file,
 * library file); callers never build filesystem paths (DES-041).
 */
export interface BlobStore {
  put(
    scope: string,
    stream: ReadableStream<Uint8Array>,
    meta?: BlobPutMeta
  ): Promise<BlobRef>
  /** Stream for `id`, or null when missing. */
  open(id: string): Promise<ReadableStream<Uint8Array> | null>
}
