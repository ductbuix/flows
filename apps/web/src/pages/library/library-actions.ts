import type { LibItem } from "@workspace/contracts"
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
      id,
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
      id,
      requestKey: requestKey(),
    })
    return { ok: true, jobId: result.jobId }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function removeItem(
  client: FlowsClient,
  id: string
): Promise<LibraryActionResult> {
  try {
    await client.call("library/remove", { id, requestKey: requestKey() })
    return "ok"
  } catch (err) {
    if (isConflictError(err)) return "conflict"
    return errorMessage(err)
  }
}
