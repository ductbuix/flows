import { apiErrorSchema, type ApiError } from "@workspace/shared"
import { api } from "@/lib/api"

function newRequestId(): string {
  return crypto.randomUUID()
}

async function readError(res: Response): Promise<string> {
  try {
    const body = apiErrorSchema.parse(await res.json())
    return body.message
  } catch {
    return `Request failed (${res.status})`
  }
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function startRun(
  workflowId: string
): Promise<ActionResult<{ runId: string }>> {
  const res = await api.workflows[":workflowId"].runs.$post({
    param: { workflowId },
    json: { requestId: newRequestId() },
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
  runId: string
): Promise<ActionResult<{ runId: string }>> {
  const res = await api.runs[":runId"].rerun.$post({
    param: { runId },
    json: { requestId: newRequestId() },
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

export type { ApiError }
