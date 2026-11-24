import type { FlowsClient } from "@workspace/sdk"
import { errorMessage, isConflictError } from "@/lib/fcp-error"

export type RunActionResult =
  | { ok: true; runId?: string }
  | { ok: false; kind: "conflict" | "error"; message: string }

function fail(err: unknown): RunActionResult {
  if (isConflictError(err)) return { ok: false, kind: "conflict", message: "" }
  return { ok: false, kind: "error", message: errorMessage(err) }
}

function requestKey(): string {
  return crypto.randomUUID()
}

export async function startRun(
  client: FlowsClient,
  params: {
    workflowId: string
    values?: Record<string, string>
    /** Docket card id (run/start cardId). */
    cardId?: string
  }
): Promise<RunActionResult> {
  try {
    const result = await client.call("run/start", {
      workflowId: params.workflowId,
      requestKey: requestKey(),
      ...(params.values ? { values: params.values } : {}),
      ...(params.cardId ? { cardId: params.cardId } : {}),
    })
    return { ok: true, runId: result.runId }
  } catch (err) {
    return fail(err)
  }
}

export async function cancelRun(
  client: FlowsClient,
  runId: string
): Promise<RunActionResult> {
  try {
    await client.call("run/cancel", { runId, requestKey: requestKey() })
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function rerunRun(
  client: FlowsClient,
  runId: string
): Promise<RunActionResult> {
  try {
    const result = await client.call("run/rerun", {
      runId,
      requestKey: requestKey(),
    })
    return { ok: true, runId: result.runId }
  } catch (err) {
    return fail(err)
  }
}

export async function deleteRun(
  client: FlowsClient,
  runId: string
): Promise<RunActionResult> {
  try {
    await client.call("run/delete", { runId, requestKey: requestKey() })
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

export async function retryStep(
  client: FlowsClient,
  runId: string,
  stepId: string
): Promise<RunActionResult> {
  try {
    await client.call("run/retry_step", {
      runId,
      stepId,
      requestKey: requestKey(),
    })
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
