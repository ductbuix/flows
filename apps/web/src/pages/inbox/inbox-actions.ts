import { ErrorCode } from "@workspace/contracts"
import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type InboxActionResult = "ok" | "conflict" | string

/** Already answered (or gone) surfaces as not_found from the engine. */
function isAlreadyAnswered(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const value = err as { code?: unknown; data?: { code?: unknown } }
  if (value.code === ErrorCode.not_found) return true
  return value.data?.code === "not_found"
}

function mapErr(err: unknown): InboxActionResult {
  if (isConflictError(err) || isAlreadyAnswered(err)) return "conflict"
  return errorMessage(err)
}

export async function answerInboxItem(
  client: FlowsClient,
  params: {
    itemId: string
    optionId: string
    answers?: { questionId: string; selectedOptionIds: string[] }[]
  }
): Promise<InboxActionResult> {
  try {
    await client.call("inbox/answer", params)
    return "ok"
  } catch (err) {
    return mapErr(err)
  }
}

export async function dismissInboxItem(
  client: FlowsClient,
  itemId: string
): Promise<InboxActionResult> {
  try {
    await client.call("inbox/dismiss", { itemId })
    return "ok"
  } catch (err) {
    return mapErr(err)
  }
}
