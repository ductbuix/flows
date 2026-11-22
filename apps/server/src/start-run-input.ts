import { createHash } from "node:crypto"
import {
  readWorkItem,
  workItemItemKey,
  type Engine,
  type ManualFilePart,
} from "@workspace/engine"
import {
  applyInputDefaults,
  buildManualValuesSchema,
  canonicalManualItemPayload,
  invalidInputErrorSchema,
  normalizeInputText,
  startRunBodySchema,
  unknownWorkItemErrorSchema,
  type InvalidInputError,
  type ManualItemKeyField,
  type StartRunBody,
  type UnknownWorkItemError,
  type WorkflowInputDecl,
} from "@workspace/shared"
import type { Context } from "hono"

function manualItemKey(fields: ManualItemKeyField[]): string {
  return createHash("sha256")
    .update(canonicalManualItemPayload(fields), "utf8")
    .digest("hex")
}

export type ParsedStartRequest = {
  body: StartRunBody
  files: ManualFilePart[]
}

/** Parse JSON or multipart start body (DES-021). */
export async function parseStartRequest(
  c: Context
): Promise<ParsedStartRequest | Response> {
  const contentType = c.req.header("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    return parseMultipartStart(c)
  }
  let json: unknown
  try {
    json = await c.req.json()
  } catch {
    return c.json({ error: "bad_request", message: "expected JSON body" }, 400)
  }
  const parsed = startRunBodySchema.safeParse(json)
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: parsed.error.message }, 400)
  }
  return { body: parsed.data, files: [] }
}

async function parseMultipartStart(
  c: Context
): Promise<ParsedStartRequest | Response> {
  const form = await c.req.parseBody({ all: true })
  const rawBody = form.body
  if (typeof rawBody !== "string") {
    return c.json(
      { error: "bad_request", message: "multipart body part is required" },
      400
    )
  }
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return c.json(
      { error: "bad_request", message: "body part must be JSON" },
      400
    )
  }
  const parsed = startRunBodySchema.safeParse(json)
  if (!parsed.success) {
    return c.json({ error: "bad_request", message: parsed.error.message }, 400)
  }
  const files: ManualFilePart[] = []
  for (const [field, value] of Object.entries(form)) {
    if (field === "body") continue
    const parts = Array.isArray(value) ? value : [value]
    for (const part of parts) {
      if (typeof part === "string") continue
      if (!part || typeof part !== "object" || !("arrayBuffer" in part))
        continue
      const file = part as File
      const data = Buffer.from(await file.arrayBuffer())
      files.push({
        field,
        basename: file.name || field,
        data,
      })
    }
  }
  return { body: parsed.data, files }
}

export type ValidatedStartInput = {
  values: Record<string, string>
  files: ManualFilePart[]
  itemKey: string
}

/**
 * Validate declared inputs and file uploads; return values + itemKey
 * or a 400 invalid_input response.
 */
export function validateStartInput(
  c: Context,
  decls: WorkflowInputDecl[],
  values: Record<string, string> | undefined,
  files: ManualFilePart[]
): ValidatedStartInput | Response {
  const fieldErrors: Record<string, string> = {}
  const rawValues = values ?? {}

  if (decls.length > 0) {
    const schema = buildManualValuesSchema(decls)
    const textResult = schema.safeParse(rawValues)
    if (!textResult.success) {
      for (const issue of textResult.error.issues) {
        const name = String(issue.path[0] ?? "values")
        fieldErrors[name] = issue.message
      }
    }
  }

  for (const decl of decls) {
    if (decl.type !== "file") continue
    const uploaded = files.filter((f) => f.field === decl.name)
    if (decl.required && uploaded.length === 0) {
      fieldErrors[decl.name] = "required"
    }
  }

  // Reject file parts for unknown declared names (not attach).
  if (decls.length > 0) {
    const declaredFiles = new Set(
      decls.filter((d) => d.type === "file").map((d) => d.name)
    )
    for (const part of files) {
      if (part.field === "attach") continue
      if (!declaredFiles.has(part.field)) {
        fieldErrors[part.field] = "unknown file field"
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const body: InvalidInputError = {
      error: "invalid_input",
      fields: fieldErrors,
    }
    return c.json(invalidInputErrorSchema.parse(body), 400)
  }

  const resolved = applyInputDefaults(decls, rawValues)
  const itemKey = computeItemKey(decls, resolved, files)
  return { values: resolved, files, itemKey }
}

export type ResolvedStartWorkItem = {
  itemKey: string
  workItemId?: string
}

/**
 * When workItemId is set, require it on disk and derive itemKey from it.
 * Ad hoc starts keep the field-based key (DES-026 / BL-039).
 */
export function resolveStartWorkItem(
  c: Context,
  engine: Engine,
  workItemId: string | undefined,
  fieldItemKey: string
): ResolvedStartWorkItem | Response {
  if (workItemId === undefined) {
    return { itemKey: fieldItemKey }
  }
  if (!readWorkItem(engine.home, workItemId)) {
    const body: UnknownWorkItemError = {
      error: "unknown_work_item",
      workItemId,
    }
    return c.json(unknownWorkItemErrorSchema.parse(body), 400)
  }
  return { itemKey: workItemItemKey(workItemId), workItemId }
}

function computeItemKey(
  decls: WorkflowInputDecl[],
  values: Record<string, string>,
  files: ManualFilePart[]
): string {
  const fields: ManualItemKeyField[] = []
  const byName = new Map(decls.map((d) => [d.name, d]))

  for (const decl of decls) {
    if (decl.type === "file") {
      const part = files.find((f) => f.field === decl.name)
      if (!part) continue
      fields.push({
        name: decl.name,
        type: "file",
        sha256: createHash("sha256").update(part.data).digest("hex"),
      })
      continue
    }
    const raw = values[decl.name]
    if (raw === undefined) continue
    fields.push({
      name: decl.name,
      type: decl.type,
      text: normalizeInputText(decl.type, raw),
    })
  }

  for (const part of files) {
    if (part.field !== "attach") continue
    fields.push({
      name: `attach/${part.basename}`,
      type: "file",
      sha256: createHash("sha256").update(part.data).digest("hex"),
    })
  }

  void byName
  return manualItemKey(fields)
}
