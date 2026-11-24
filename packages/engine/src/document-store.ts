import { createNodeDocumentStore } from "@workspace/adapters-node"
import type { DocumentStore } from "@workspace/core/ports"

let store: DocumentStore = createNodeDocumentStore()

export function getDocumentStore(): DocumentStore {
  return store
}

export function setDocumentStore(next: DocumentStore): void {
  store = next
}
