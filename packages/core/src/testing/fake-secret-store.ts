import { assertSecretKey } from "../ports/secret-key.ts"
import type { SecretStore } from "../ports/secret-store.ts"

export function createFakeSecretStore(): SecretStore {
  return new FakeSecretStore()
}

class FakeSecretStore implements SecretStore {
  private readonly values = new Map<string, string>()

  get(key: string): string | null {
    assertSecretKey(key)
    return this.values.has(key) ? this.values.get(key)! : null
  }

  set(key: string, value: string): void {
    assertSecretKey(key)
    this.values.set(key, value)
  }

  delete(key: string): void {
    assertSecretKey(key)
    this.values.delete(key)
  }
}
