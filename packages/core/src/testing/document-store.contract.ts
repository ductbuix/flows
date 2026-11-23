import { describe, expect, it, beforeEach } from "vitest"
import { hashUtf8Text } from "../kernel/hash.ts"
import type { DocumentStore } from "../ports/document-store.ts"

export type DocumentStoreFactory = () => DocumentStore

export function describeDocumentStoreContract(
  title: string,
  factories: ReadonlyArray<readonly [string, DocumentStoreFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, createStore) => {
    let store: DocumentStore

    beforeEach(() => {
      store = createStore()
    })

    it("read missing file returns null", () => {
      expect(store.read("/no/such/file.txt")).toBeNull()
    })

    it("write then read round-trips text and hash", () => {
      const path = "/docs/a.txt"
      const text = "hello\n"
      const w = store.write(path, text)
      expect(w).toEqual({ ok: true, text, hash: hashUtf8Text(text) })
      expect(store.read(path)).toEqual({ text, hash: hashUtf8Text(text) })
    })

    it("write with stale baseHash returns conflict", () => {
      const path = "/docs/b.md"
      store.write(path, "v1")
      const r = store.write(path, "v2", { baseHash: hashUtf8Text("stale") })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.kind).toBe("conflict")
        expect(r.text).toBe("v1")
        expect(r.hash).toBe(hashUtf8Text("v1"))
      }
      expect(store.read(path)?.text).toBe("v1")
    })

    it("write with matching baseHash succeeds", () => {
      const path = "/docs/c.md"
      store.write(path, "one")
      const base = hashUtf8Text("one")
      const w = store.write(path, "two", { baseHash: base })
      expect(w).toEqual({ ok: true, text: "two", hash: hashUtf8Text("two") })
    })

    it("treats missing file as empty for baseHash check", () => {
      const path = "/new.md"
      const w = store.write(path, "fresh", { baseHash: hashUtf8Text("") })
      expect(w.ok).toBe(true)
    })

    it("list matches glob patterns", () => {
      store.write("/a/x.md", "1")
      store.write("/a/y.txt", "2")
      store.write("/b/z.md", "3")
      expect(store.list("**/*.md")).toEqual(["/a/x.md", "/b/z.md"])
      expect(store.list("/a/*.md")).toEqual(["/a/x.md"])
    })

    it("remove deletes an existing file", () => {
      const path = "/drop.me"
      store.write(path, "x")
      expect(store.remove(path)).toEqual({ ok: true })
      expect(store.read(path)).toBeNull()
    })

    it("remove missing returns not_found", () => {
      expect(store.remove("/missing")).toEqual({ ok: false, kind: "not_found" })
    })
  })
}
