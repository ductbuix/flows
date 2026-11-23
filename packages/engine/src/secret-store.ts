import { createNodeSecretStore } from "@workspace/adapters-node"
import type { SecretStore } from "@workspace/core/ports"

let store: SecretStore = createNodeSecretStore()

export function getSecretStore(): SecretStore {
  return store
}

export function setSecretStore(next: SecretStore): void {
  store = next
}
