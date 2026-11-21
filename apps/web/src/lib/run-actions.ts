import {
  apiErrorSchema,
  duplicateInputErrorSchema,
  invalidInputErrorSchema,
  startRunResponseSchema,
  trustRequiredErrorSchema,
  type ApiError,
  type DuplicateInputError,
  type InvalidInputError,
  type StartRunResponse,
  type TrustGrant,
} from "@workspace/shared"
import { api } from "@/lib/api"

function newRequestId(): string {
  return crypto.randomUUID()
}

type ParsedFailure =
  | { kind: "message"; error: string }
  | { kind: "invalid_input"; fields: Record<string, string> }
  | { kind: "duplicate_input"; detail: DuplicateInputError }

async function parseFailure(res: Response): Promise<ParsedFailure> {
  try {
    const json: unknown = await res.json()
    const dup = duplicateInputErrorSchema.safeParse(json)
    if (dup.success) {
      return { kind: "duplicate_input", detail: dup.data }
    }
    const invalid = invalidInputErrorSchema.safeParse(json)
    if (invalid.success) {
      return { kind: "invalid_input", fields: invalid.data.fields }
    }
    const trust = trustRequiredErrorSchema.safeParse(json)
    if (trust.success) return { kind: "message", error: trust.data.message }
    const body = apiErrorSchema.parse(json)
    return { kind: "message", error: body.message }
  } catch {
    return { kind: "message", error: `Request failed (${res.status})` }
  }
}

async function readError(res: Response): Promise<string> {
  const failure = await parseFailure(res)
  if (failure.kind === "message") return failure.error
  if (failure.kind === "invalid_input") {
    return Object.values(failure.fields).join("; ") || "Invalid input"
  }
  return `Duplicate input (${failure.detail.existingRunIds.length} run(s))`
}

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string }

export type StartRunOptions = {
  trustGrant?: TrustGrant
  values?: Record<string, string>
  files?: { field: string; file: File }[]
  confirmDuplicate?: boolean
}

export type StartRunResult =
  | { ok: true; data: StartRunResponse }
  | (
      | { ok: false; kind: "message"; error: string }
      | { ok: false; kind: "invalid_input"; fields: Record<string, string> }
      | { ok: false; kind: "duplicate_input"; detail: DuplicateInputError }
    )

function startRunJsonBody(options: StartRunOptions) {
  return {
    requestId: newRequestId(),
    ...(options.trustGrant !== undefined && { trustGrant: options.trustGrant }),
    ...(options.values !== undefined && { values: options.values }),
    ...(options.confirmDuplicate === true && { confirmDuplicate: true }),
  }
}

async function postStartRun(
  url: string,
  options: StartRunOptions
): Promise<Response> {
  const jsonBody = startRunJsonBody(options)
  const files = options.files ?? []
  if (files.length === 0) {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jsonBody),
    })
  }
  const form = new FormData()
  form.append("body", JSON.stringify(jsonBody))
  for (const { field, file } of files) {
    form.append(field, file, file.name)
  }
  return fetch(url, { method: "POST", body: form })
}

async function parseStartResponse(res: Response): Promise<StartRunResult> {
  if (!res.ok) {
    const failure = await parseFailure(res)
    if (failure.kind === "message") {
      return { ok: false, kind: "message", error: failure.error }
    }
    if (failure.kind === "invalid_input") {
      return { ok: false, kind: "invalid_input", fields: failure.fields }
    }
    return { ok: false, kind: "duplicate_input", detail: failure.detail }
  }
  const data = startRunResponseSchema.parse(await res.json())
  return { ok: true, data }
}

export async function startRun(
  workflowId: string,
  options: StartRunOptions = {}
): Promise<StartRunResult> {
  const res = await postStartRun(
    `${window.location.origin}/api/workflows/${encodeURIComponent(workflowId)}/runs`,
    options
  )
  return parseStartResponse(res)
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
  options: StartRunOptions = {}
): Promise<StartRunResult> {
  const res = await postStartRun(
    `${window.location.origin}/api/runs/${encodeURIComponent(runId)}/rerun`,
    options
  )
  return parseStartResponse(res)
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
  ActionResult<{ alwaysTrusted: boolean; homeRealpath: string }>
> {
  const res = await api.trust.$get()
  if (!res.ok) return { ok: false, error: await readError(res) }
  const data = (await res.json()) as {
    alwaysTrusted: boolean
    homeRealpath: string
  }
  return { ok: true, data }
}

export type { ApiError, InvalidInputError, DuplicateInputError }
