export type DocumentRead = { text: string; hash: string }

export type DocumentWriteResult =
  | { ok: true; text: string; hash: string }
  | { ok: false; kind: "conflict"; text: string; hash: string }

export type DocumentRemoveResult =
  { ok: true } | { ok: false; kind: "not_found" }

export type DocumentWriteOptions = { baseHash?: string }

/** Text files under FLOWAPP_HOME; writes are atomic; optional baseHash optimistic lock (DES-041). */
export interface DocumentStore {
  read(path: string): DocumentRead | null
  write(
    path: string,
    text: string,
    options?: DocumentWriteOptions
  ): DocumentWriteResult
  list(glob: string): string[]
  remove(path: string): DocumentRemoveResult
}
