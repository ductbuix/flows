import {
  NODE_KINDS,
  workflowInputDeclSchema,
  type WorkflowInputDecl,
} from "@workspace/shared"

/** The setting keys a kind declares; the Sheet shows only those (DES-036). */
export function settingKeys(kind: string): ReadonlySet<string> {
  const def = NODE_KINDS.find((k) => k.kind === kind)
  return new Set(def ? Object.keys(def.settings) : [])
}

/** A positive whole number from a field; `undefined` clears, `null` is invalid. */
export function parsePositiveInt(raw: string): number | undefined | null {
  const text = raw.trim()
  if (text === "") return undefined
  const n = Number(text)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** First free `inputN` name. */
export function nextInputName(existing: readonly WorkflowInputDecl[]): string {
  const used = new Set(existing.map((d) => d.name))
  for (let n = 1; n < 100; n++) {
    if (!used.has(`input${n}`)) return `input${n}`
  }
  return `input${Date.now()}`
}

/** Why an input row cannot be saved, or null. `others` are the other rows. */
export function inputProblem(
  row: WorkflowInputDecl,
  others: readonly WorkflowInputDecl[]
): string | null {
  const parsed = workflowInputDeclSchema.safeParse(row)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input"
  if (others.some((o) => o.name === row.name)) {
    return `duplicate input name ${row.name}`
  }
  return null
}
