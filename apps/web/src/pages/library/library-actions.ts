import {
  LibItemId,
  type LibItem,
  type ProviderIcon,
} from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type LibraryActionResult = "ok" | "conflict" | string

function requestKey(): string {
  return crypto.randomUUID()
}

export async function pinVersion(
  client: FlowsClient,
  id: string,
  n: number
): Promise<LibraryActionResult | LibItem> {
  try {
    return await client.call("library/pin_version", {
      id: LibItemId.parse(id),
      n,
      requestKey: requestKey(),
    })
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

export async function pullItem(
  client: FlowsClient,
  id: string
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const result = await client.call("library/pull", {
      id: LibItemId.parse(id),
      requestKey: requestKey(),
    })
    return { ok: true, jobId: result.jobId }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function pushItem(
  client: FlowsClient,
  id: string
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const result = await client.call("library/push", {
      id: LibItemId.parse(id),
      requestKey: requestKey(),
    })
    return { ok: true, jobId: result.jobId }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function unlinkItem(
  client: FlowsClient,
  id: string
): Promise<LibraryActionResult | LibItem> {
  try {
    return await client.call("library/unlink", {
      id: LibItemId.parse(id),
      requestKey: requestKey(),
    })
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

export async function setTags(
  client: FlowsClient,
  id: string,
  tags: string[]
): Promise<LibraryActionResult | LibItem> {
  try {
    return await client.call("library/set_tags", {
      id: LibItemId.parse(id),
      tags,
      requestKey: requestKey(),
    })
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

export async function addFromLink(
  client: FlowsClient,
  url: string
): Promise<
  { ok: true; id: string; jobId: string | null } | { ok: false; error: string }
> {
  try {
    const item = await client.call("library/add", {
      kind: "remote",
      url,
      requestKey: requestKey(),
    })
    const pull = await pullItem(client, item.id)
    if (!pull.ok) return { ok: true, id: item.id, jobId: null }
    return { ok: true, id: item.id, jobId: pull.jobId }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function addFromDisk(
  client: FlowsClient,
  input: {
    title: string
    itemKind: ProviderIcon
    tags: string[]
    files: Record<string, string>
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const item = await client.call("library/add", {
      kind: "local",
      title: input.title,
      itemKind: input.itemKind,
      tags: input.tags,
      files: input.files,
      requestKey: requestKey(),
    })
    return { ok: true, id: item.id }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function removeItem(
  client: FlowsClient,
  id: string
): Promise<LibraryActionResult> {
  try {
    await client.call("library/remove", {
      id: LibItemId.parse(id),
      requestKey: requestKey(),
    })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}
