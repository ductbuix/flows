import type { SecretStore } from "../ports/secret-store.ts"

export function createFakeSecretStore(): SecretStore {
  return new FakeSecretStore()
}

class FakeSecretStore implements SecretStore {
  private readonly values = new Map<string, string>()

  get(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null
  }

  set(key: string, value: string): void {
    this.values.set(key, value)
  }

  delete(key: string): void {
    this.values.delete(key)
  }
}
