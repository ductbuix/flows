import { cardSchema, type Card } from "./schemas.ts"

export type TolerantParseResult<T> = {
  data: T | null
  warnings: string[]
}

const CARD_DATE_KEYS = ["created", "updated", "start", "due", "done"] as const

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function warnInvalidIso(
  warnings: string[],
  path: string,
  value: unknown
): void {
  if (typeof value !== "string") return
  if (!isIsoDateString(value)) {
    warnings.push(`${path}: expected ISO date, got ${JSON.stringify(value)}`)
  }
}

/**
 * Validates card frontmatter loosely: structural errors yield null data;
 * invalid ISO dates still return data with warnings (for the docket store).
 */
export function tolerantParseCard(input: unknown): TolerantParseResult<Card> {
  const parsed = cardSchema.safeParse(input)
  if (!parsed.success) {
    return {
      data: null,
      warnings: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`
      ),
    }
  }
  const warnings: string[] = []
  const data = parsed.data
  for (const key of CARD_DATE_KEYS) {
    const value = data[key]
    if (value != null) warnInvalidIso(warnings, key, value)
  }
  if (data.refs) {
    for (let i = 0; i < data.refs.length; i++) {
      const syncedAt = data.refs[i]?.syncedAt
      if (syncedAt != null) {
        warnInvalidIso(warnings, `refs[${i}].syncedAt`, syncedAt)
      }
    }
  }
  return { data, warnings }
}
