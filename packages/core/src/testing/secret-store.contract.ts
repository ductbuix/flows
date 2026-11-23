import { beforeEach, describe, expect, it } from "vitest"
import type { SecretStore } from "../ports/secret-store.ts"

export type SecretStoreFactory = () => SecretStore

export function describeSecretStoreContract(
  title: string,
  factories: ReadonlyArray<readonly [string, SecretStoreFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, createStore) => {
    let store: SecretStore

    beforeEach(() => {
      store = createStore()
    })

    it("get missing key returns null", () => {
      expect(store.get("missing")).toBeNull()
    })

    it("set then get round-trips the value", () => {
      store.set("token", "s3cret")
      expect(store.get("token")).toBe("s3cret")
    })

    it("set overwrites an existing key", () => {
      store.set("k", "v1")
      store.set("k", "v2")
      expect(store.get("k")).toBe("v2")
    })

    it("delete removes a key", () => {
      store.set("k", "v")
      store.delete("k")
      expect(store.get("k")).toBeNull()
    })

    it("delete of a missing key is a no-op", () => {
      expect(() => store.delete("nope")).not.toThrow()
      expect(store.get("nope")).toBeNull()
    })

    it("keys are independent", () => {
      store.set("a", "1")
      store.set("b", "2")
      store.delete("a")
      expect(store.get("a")).toBeNull()
      expect(store.get("b")).toBe("2")
    })
  })
}
