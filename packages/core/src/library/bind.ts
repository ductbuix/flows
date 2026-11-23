import {
  libraryListProvidersMethod,
  librarySaveProviderMethod,
  type ProviderDescriptor,
} from "@workspace/contracts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { ProviderService } from "./providers.ts"

export type LibraryProviderBindings = Pick<
  MethodBindings,
  "library/list_providers" | "library/save_provider"
>

export function createLibraryProviderBindings(
  service: ProviderService
): LibraryProviderBindings {
  return {
    "library/list_providers": defineBinding(
      libraryListProvidersMethod,
      (params) => pageProviders(service.list(), params.cursor, params.limit)
    ),
    "library/save_provider": defineBinding(
      librarySaveProviderMethod,
      (params) => {
        service.save(params.provider)
        return {}
      }
    ),
  }
}

function pageProviders(
  items: ProviderDescriptor[],
  cursor: string | undefined,
  limit: number | undefined
): { items: ProviderDescriptor[]; next?: string } {
  let start = 0
  if (cursor !== undefined) {
    const idx = items.findIndex((p) => p.id === cursor)
    start = idx === -1 ? items.length : idx + 1
  }
  const size = limit ?? items.length
  const page = items.slice(start, start + size)
  const last = page[page.length - 1]
  const more = start + page.length < items.length
  return {
    items: page,
    ...(more && last ? { next: last.id } : {}),
  }
}
