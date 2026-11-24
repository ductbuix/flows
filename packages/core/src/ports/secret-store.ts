/** Opaque secret values by key; Node adapter uses keychain / secrets/ (DES-041). */
export interface SecretStore {
  get(key: string): string | null
  set(key: string, value: string): void
  delete(key: string): void
}
