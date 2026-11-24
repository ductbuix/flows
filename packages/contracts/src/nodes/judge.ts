import { z } from "zod"
import { effortSchema, modelIdSchema } from "../model-effort.ts"
import { ANSWER_NAME_PATTERN, stepSettings } from "./common.ts"
import { defineNodeKind } from "./define.ts"

/** Operators of check mode, as OpenBot `WORKFLOW_CHECK_OPERATORS` (DES-032). */
export const CHECK_OPERATORS = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "contains",
  "set",
  "unset",
] as const

export type CheckOperator = (typeof CHECK_OPERATORS)[number]

/** Operators that compare numbers. */
export const NUMBER_OPERATORS: readonly CheckOperator[] = [">", ">=", "<", "<="]

/** Operators that take no value. */
export const UNARY_OPERATORS: readonly CheckOperator[] = ["set", "unset"]

/** A named answer tested against an operator and a value, no model call. */
export const judgeCheckSchema = z.strictObject({
  field: z
    .string()
    .regex(ANSWER_NAME_PATTERN, "field: the name of an upstream answer"),
  operator: z.enum(CHECK_OPERATORS),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

export type JudgeCheck = z.infer<typeof judgeCheckSchema>

/** `rule` asks the CLI; `check` tests a named answer (DES-032). */
export const judgeModeSchema = z.enum(["rule", "check"])

/** Judge: the CLI answers yes or no (rule), or a check tests an answer; the result picks the branch (DES-032). */
export const judgeKind = defineNodeKind({
  kind: "judge",
  group: "flow",
  // Both branches forward what came in, so the out ports follow the in ports.
  ports: { in: ["text", "file"], out: ["text", "file"] },
  branches: ["yes", "no"],
  // `rule.md` is read in rule mode only.
  files: [{ path: "rule.md", required: true }],
  process: "cli",
  settings: {
    mode: judgeModeSchema.optional(),
    // Rule mode only: validated against `mode` in the workflow schema.
    cli: z.enum(["claude", "cursor"]).optional(),
    model: modelIdSchema.optional(),
    effort: effortSchema.optional(),
    check: judgeCheckSchema.optional(),
    ...stepSettings,
  },
})

/** Problems with a Judge's settings that depend on its mode; one message each. */
export function judgeSettingProblems(node: {
  mode?: "rule" | "check"
  cli?: string
  model?: string
  effort?: string
  check?: JudgeCheck
}): { key: string; message: string }[] {
  const out: { key: string; message: string }[] = []
  if ((node.mode ?? "rule") === "rule") {
    if (node.cli === undefined)
      out.push({ key: "cli", message: "judge needs cli" })
    if (node.check !== undefined) {
      out.push({ key: "check", message: "check is only for mode: check" })
    }
    return out
  }
  if (node.check === undefined) {
    out.push({ key: "check", message: "check mode needs check" })
  } else {
    const { operator, value } = node.check
    if (UNARY_OPERATORS.includes(operator)) {
      if (value !== undefined) {
        out.push({ key: "check", message: `${operator} takes no value` })
      }
    } else if (value === undefined) {
      out.push({ key: "check", message: `${operator} needs a value` })
    } else if (
      NUMBER_OPERATORS.includes(operator) &&
      toNumber(value) === undefined
    ) {
      out.push({ key: "check", message: `${operator} needs a number` })
    }
  }
  for (const key of ["cli", "model", "effort"] as const) {
    if (node[key] !== undefined) {
      out.push({ key, message: `${key} is only for mode: rule` })
    }
  }
  return out
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Text form used to compare: yes or no for a boolean, a comma list for a list. */
function asText(v: unknown): string {
  if (typeof v === "boolean") return v ? "yes" : "no"
  if (Array.isArray(v)) return v.map(String).join(", ")
  return String(v ?? "").trim()
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number") {
    const y = toNumber(b)
    if (y !== undefined) return a === y
  }
  const norm = (v: unknown) => {
    const t = asText(v).toLowerCase()
    return t === "true" ? "yes" : t === "false" ? "no" : t
  }
  return norm(a) === norm(b)
}

function isSet(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "string") return v.trim() !== ""
  return true
}

/**
 * Tests one answer value (DES-032). Text compares ignore case; `>` and
 * friends need numbers on both sides and are false otherwise; `contains`
 * looks for an item in a list or a piece of text. A missing value is
 * unset, equals nothing and differs from everything.
 */
export function evaluateCheck(check: JudgeCheck, actual: unknown): boolean {
  const { operator, value } = check
  switch (operator) {
    case "set":
      return isSet(actual)
    case "unset":
      return !isSet(actual)
    case "=":
      return isSet(actual) && same(actual, value)
    case "!=":
      return !(isSet(actual) && same(actual, value))
    case "contains": {
      if (!isSet(actual)) return false
      const needle = asText(value).toLowerCase()
      return Array.isArray(actual)
        ? actual.some((x) => asText(x).toLowerCase() === needle)
        : asText(actual).toLowerCase().includes(needle)
    }
    default: {
      const a = toNumber(actual)
      const b = toNumber(value)
      if (a === undefined || b === undefined) return false
      if (operator === ">") return a > b
      if (operator === ">=") return a >= b
      if (operator === "<") return a < b
      return a <= b
    }
  }
}
