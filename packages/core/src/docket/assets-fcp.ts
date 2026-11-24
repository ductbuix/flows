import {
  docketAddAssetMethod,
  docketRemoveAssetMethod,
  type DocketAsset,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { BlobStore } from "../ports/blob-store.ts"
import { defineBinding } from "../rpc/bind.ts"
import {
  loadCurrentCard,
  publishCardChanged,
  type DocketWriteDeps,
} from "./write-helpers.ts"
import { ownedAssetRelPath } from "./store.ts"

export function bindDocketAddAsset(deps: DocketWriteDeps) {
  return defineBinding(docketAddAssetMethod, async (params) => {
    const entry = deps.index.getCard(params.id)
    if (!entry) {
      throw engineError("not_found", `Card not found: ${params.id}`)
    }
    const existing = entry.assets
    if (params.scope === "owned") {
      const name = safeAssetBasename(params.name)
      const rel = ownedAssetRelPath(name)
      assertNoDuplicate(existing, rel)
      const text = await readBlobUtf8(deps.blobs, params.blobId)
      const fileWrite = deps.store.writeOwnedAsset(params.id, name, text)
      if (!fileWrite.ok) {
        throw engineError("internal", `Failed to write ${rel}`)
      }
      const asset: DocketAsset = {
        path: rel,
        ...(params.label !== undefined ? { label: params.label } : {}),
      }
      const hash = appendAsset(
        deps,
        params.id,
        params.baseHash,
        asset,
        existing
      )
      deps.index.refreshCard(params.id)
      publishCardChanged(deps, params.id)
      const indexed = deps.index
        .getCard(params.id)
        ?.assets.find((a) => a.path === rel)
      if (!indexed) {
        throw engineError("internal", "Asset missing after add")
      }
      return { hash, asset: indexed }
    }

    if (!params.path.startsWith("/")) {
      throw engineError("invalid_params", "Linked asset path must be absolute")
    }
    assertNoDuplicate(existing, params.path)
    const asset: DocketAsset = {
      path: params.path,
      scope: "linked",
      ...(params.label !== undefined ? { label: params.label } : {}),
    }
    const hash = appendAsset(deps, params.id, params.baseHash, asset, existing)
    deps.index.refreshCard(params.id)
    publishCardChanged(deps, params.id)
    const indexed = deps.index
      .getCard(params.id)
      ?.assets.find((a) => a.path === params.path)
    if (!indexed) {
      throw engineError("internal", "Asset missing after add")
    }
    return { hash, asset: indexed }
  })
}

export function bindDocketRemoveAsset(deps: DocketWriteDeps) {
  return defineBinding(docketRemoveAssetMethod, (params) => {
    const entry = deps.index.getCard(params.id)
    if (!entry) {
      throw engineError("not_found", `Card not found: ${params.id}`)
    }
    const next = entry.assets.filter((a) => a.path !== params.path)
    if (next.length === entry.assets.length) {
      throw engineError("not_found", `Asset not on card: ${params.path}`)
    }
    // Drop the frontmatter entry only; never delete the target file (DES-038).
    const assets: DocketAsset[] = next.map(({ path, label, scope }) => ({
      path,
      ...(label !== undefined ? { label } : {}),
      ...(scope === "linked" ? { scope } : {}),
    }))
    const written = deps.store.saveCard(
      params.id,
      { assets },
      { baseHash: params.baseHash }
    )
    if (!written.ok) {
      if (written.kind === "conflict") {
        throw engineError("conflict", "Stale baseHash", {
          current: loadCurrentCard(deps, params.id),
        })
      }
      throw engineError("internal", "Failed to remove asset")
    }
    deps.index.refreshCard(params.id)
    publishCardChanged(deps, params.id)
    return { hash: written.hash }
  })
}

function appendAsset(
  deps: DocketWriteDeps,
  cardId: string,
  baseHash: string,
  asset: DocketAsset,
  existing: ReadonlyArray<{ path: string; label?: string; scope: string }>
): string {
  const assets: DocketAsset[] = [
    ...existing.map(({ path, label, scope }) => ({
      path,
      ...(label !== undefined ? { label } : {}),
      ...(scope === "linked" ? { scope: "linked" as const } : {}),
    })),
    asset,
  ]
  const written = deps.store.saveCard(cardId, { assets }, { baseHash })
  if (!written.ok) {
    if (written.kind === "conflict") {
      throw engineError("conflict", "Stale baseHash", {
        current: loadCurrentCard(deps, cardId),
      })
    }
    throw engineError("internal", "Failed to add asset")
  }
  return written.hash
}

function assertNoDuplicate(
  existing: ReadonlyArray<{ path: string }>,
  path: string
): void {
  if (existing.some((a) => a.path === path)) {
    throw engineError("invalid_params", `Asset already on card: ${path}`)
  }
}

function safeAssetBasename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? ""
  if (!base || base === "." || base === "..") {
    throw engineError("invalid_params", `Invalid asset name: ${name}`)
  }
  return base
}

async function readBlobUtf8(blobs: BlobStore, id: string): Promise<string> {
  const stream = await blobs.open(id)
  if (!stream) {
    throw engineError("not_found", `Blob not found: ${id}`)
  }
  const bytes = await readAll(stream)
  return new TextDecoder("utf-8").decode(bytes)
}

async function readAll(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}
