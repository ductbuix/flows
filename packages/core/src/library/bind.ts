import {
  libraryGetMethod,
  libraryListMethod,
  libraryListProvidersMethod,
  libraryPinVersionMethod,
  libraryPullMethod,
  libraryRemoveMethod,
  librarySaveProviderMethod,
  librarySetTagsMethod,
  type LibItem,
  type ProviderDescriptor,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { ProviderService } from "./providers.ts"
import type { LibraryService } from "./service.ts"

export type LibraryProviderBindings = Pick<
  MethodBindings,
  "library/list_providers" | "library/save_provider"
>

export type LibraryItemBindings = Pick<
  MethodBindings,
  | "library/list"
  | "library/get"
  | "library/pull"
  | "library/pin_version"
  | "library/set_tags"
  | "library/remove"
>

export type LibraryBindings = LibraryProviderBindings & LibraryItemBindings

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

export function createLibraryItemBindings(
  service: LibraryService
): LibraryItemBindings {
  return {
    "library/list": defineBinding(libraryListMethod, (params) =>
      pageItems(service.list(params.tag), params.cursor, params.limit)
    ),
    "library/get": defineBinding(libraryGetMethod, (params) => {
      const item = service.get(params.id)
      if (!item)
        throw engineError("not_found", `Library item not found: ${params.id}`)
      return item
    }),
    "library/pull": defineBinding(libraryPullMethod, (params, ctx) =>
      service.pull(params.id, ctx.signal)
    ),
    "library/pin_version": defineBinding(libraryPinVersionMethod, (params) =>
      service.pinVersion(params.id, params.n)
    ),
    "library/set_tags": defineBinding(librarySetTagsMethod, (params) =>
      service.setTags(params.id, params.tags)
    ),
    "library/remove": defineBinding(libraryRemoveMethod, (params) => {
      service.remove(params.id)
      return {}
    }),
  }
}

export function createLibraryBindings(
  providers: ProviderService,
  library: LibraryService
): LibraryBindings {
  return {
    ...createLibraryProviderBindings(providers),
    ...createLibraryItemBindings(library),
  }
}

function pageProviders(
  items: ProviderDescriptor[],
  cursor: string | undefined,
  limit: number | undefined
): { items: ProviderDescriptor[]; next?: string } {
  return pageById(items, cursor, limit)
}

function pageItems(
  items: LibItem[],
  cursor: string | undefined,
  limit: number | undefined
): { items: LibItem[]; next?: LibItem["id"] } {
  return pageById(items, cursor, limit)
}

function pageById<T extends { id: string }>(
  items: T[],
  cursor: string | undefined,
  limit: number | undefined
): { items: T[]; next?: T["id"] } {
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
