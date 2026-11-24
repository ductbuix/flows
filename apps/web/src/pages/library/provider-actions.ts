import type { ProviderDescriptor } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type ProviderActionResult = "ok" | "conflict" | string

export async function saveProvider(
  client: FlowsClient,
  provider: ProviderDescriptor
): Promise<ProviderActionResult> {
  try {
    await client.call("library/save_provider", { provider })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}

/** Merge a saved provider into the listed set (no library/update yet). */
export function upsertProvider(
  items: readonly ProviderDescriptor[],
  provider: ProviderDescriptor
): ProviderDescriptor[] {
  const next = items.filter((p) => p.id !== provider.id)
  next.push(provider)
  return next.sort((a, b) => a.id.localeCompare(b.id))
}
