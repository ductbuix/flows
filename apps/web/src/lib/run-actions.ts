import {
  apiErrorSchema,
  trustRequiredErrorSchema,
  type ApiError,
  type TrustGrant,
} from "@workspace/shared"
import { api } from "@/lib/api"

function newRequestId(): string {
  return crypto.randomUUID()
}

async function readError(res: Response): Promise<string> {
  try {
    const json: unknown = await res.json()
    const trust = trustRequiredErrorSchema.safeParse(json)
    if (trust.success) return trust.data.message
    const body = apiErrorSchema.parse(json)
    return body.message
  } catch {
    return `Request failed (${res.status})`
  }
}

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string }

export async function startRun(
  workflowId: string,
  trustGrant?: TrustGrant
): Promise<ActionResult<{ runId: string }>> {
  const res = await api.workflows[":workflowId"].runs.$post({
    param: { workflowId },
    json: { requestId: newRequestId(), trustGrant },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  const data = (await res.json()) as { runId: string }
  return { ok: true, data }
}

export async function cancelRun(runId: string): Promise<ActionResult> {
  const res = await api.runs[":runId"].cancel.$post({
    param: { runId },
    json: { requestId: newRequestId() },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function rerunRun(
  runId: string,
  trustGrant?: TrustGrant
): Promise<ActionResult<{ runId: string }>> {
  const res = await api.runs[":runId"].rerun.$post({
    param: { runId },
    json: { requestId: newRequestId(), trustGrant },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  const data = (await res.json()) as { runId: string }
  return { ok: true, data }
}

export async function retryTask(
  runId: string,
  taskId: string
): Promise<ActionResult> {
  const res = await api.runs[":runId"].tasks[":taskId"].retry.$post({
    param: { runId, taskId },
    json: { requestId: newRequestId() },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function approveTask(
  runId: string,
  taskId: string
): Promise<ActionResult> {
  const res = await api.runs[":runId"].tasks[":taskId"].approve.$post({
    param: { runId, taskId },
    json: { requestId: newRequestId() },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function rejectTask(
  runId: string,
  taskId: string
): Promise<ActionResult> {
  const res = await api.runs[":runId"].tasks[":taskId"].reject.$post({
    param: { runId, taskId },
    json: { requestId: newRequestId() },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function deleteRun(runId: string): Promise<ActionResult> {
  const res = await api.runs[":runId"].$delete({
    param: { runId },
    json: { requestId: newRequestId() },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function revokeTrust(): Promise<ActionResult> {
  const res = await api.trust.$put({
    json: { grant: "none" },
  })
  if (!res.ok) return { ok: false, error: await readError(res) }
  return { ok: true, data: undefined }
}

export async function fetchTrustStatus(): Promise<
  ActionResult<{ alwaysTrusted: boolean }>
> {
  const res = await api.trust.$get()
  if (!res.ok) return { ok: false, error: await readError(res) }
  const data = (await res.json()) as { alwaysTrusted: boolean }
  return { ok: true, data }
}

export type { ApiError }
