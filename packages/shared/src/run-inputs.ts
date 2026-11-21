import { z } from "zod"
import type { WorkflowInputDecl } from "./workflow.ts"

export type ManualItemKeyField =
  | { name: string; type: "text" | "markdown"; text: string }
  | { name: string; type: "file"; sha256: string }

/** Normalize a text/markdown value for the item key (DES-021). */
export function normalizeInputText(
  type: "text" | "markdown",
  value: string
): string {
  const nfc = value.normalize("NFC")
  return type === "text" ? nfc.trim() : nfc
}

/**
 * Canonical JSON for the Manual item key (DES-021).
 * Hash with SHA-256 in Node (engine/server); shared stays browser-safe.
 */
export function canonicalManualItemPayload(
  fields: ManualItemKeyField[]
): string {
  const sorted = [...fields].sort((a, b) => a.name.localeCompare(b.name))
  return JSON.stringify({
    v: 1,
    source: "manual",
    fields: sorted,
  })
}

/**
 * Zod schema for declared text/markdown values (and required presence).
 * File fields are validated separately from multipart uploads (DES-021).
 */
export function buildManualValuesSchema(decls: WorkflowInputDecl[]) {
  const shape: Record<string, z.ZodType<string | undefined>> = {}
  for (const decl of decls) {
    if (decl.type === "file") continue
    let field: z.ZodType<string | undefined> = z.string()
    if (decl.required) {
      field = z.string().refine((v) => v.trim().length > 0, "required")
    } else {
      field = z.string().optional()
    }
    shape[decl.name] = field
  }
  return z.object(shape).passthrough()
}

/** Apply defaults for missing optional text/markdown fields. */
export function applyInputDefaults(
  decls: WorkflowInputDecl[],
  values: Record<string, string | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) out[k] = v
  }
  for (const decl of decls) {
    if (decl.type === "file") continue
    if (out[decl.name] !== undefined) continue
    if (decl.default !== undefined) out[decl.name] = decl.default
  }
  return out
}
