import { z } from "zod"
import {
  assetSchema,
  boardColumnSchema,
  cardIdSchema,
  cardLinkSchema,
  refSchema,
  type Board,
  type Card,
} from "./schemas.ts"

export type TolerantParseResult<T> = {
  data: T | null
  warnings: string[]
}

const CARD_REQUIRED = ["id", "title", "status", "created", "updated"] as const

const CARD_DATE_KEYS = ["created", "updated", "start", "due", "done"] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function issueSummary(issue: z.core.$ZodIssue): string {
  return `${issue.path.map(String).join(".") || "(value)"}: ${issue.message}`
}

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

function parseEntryList<T extends z.ZodType>(
  raw: unknown,
  key: string,
  schema: T,
  warnings: string[]
): z.infer<T>[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    warnings.push(`${key}: expected array`)
    return undefined
  }
  const kept: z.infer<T>[] = []
  for (let i = 0; i < raw.length; i++) {
    const parsed = schema.safeParse(raw[i])
    if (parsed.success) kept.push(parsed.data)
    else {
      const detail = parsed.error.issues.map(issueSummary).join("; ")
      warnings.push(`${key}[${i}]: ${detail}`)
    }
  }
  return kept
}

const cardRequiredShape = {
  id: cardIdSchema,
  title: z.string().min(1),
  status: z.string(),
  created: z.string(),
  updated: z.string(),
} as const

/**
 * Validates card frontmatter loosely: invalid list entries are dropped;
 * only missing required keys or a non-object root yield null data.
 */
export function tolerantParseCard(input: unknown): TolerantParseResult<Card> {
  const warnings: string[] = []
  if (!isPlainObject(input)) {
    return { data: null, warnings: ["(root): expected object"] }
  }

  const required: Record<string, unknown> = {}
  let requiredFailed = false
  for (const key of CARD_REQUIRED) {
    const value = input[key]
    if (value === undefined) {
      warnings.push(`${key}: required`)
      requiredFailed = true
      continue
    }
    const parsed = cardRequiredShape[key].safeParse(value)
    if (!parsed.success) {
      warnings.push(
        `${key}: ${parsed.error.issues.map(issueSummary).join("; ")}`
      )
      requiredFailed = true
    } else {
      required[key] = parsed.data
    }
  }
  if (requiredFailed) return { data: null, warnings }

  const data: Record<string, unknown> = { ...input, ...required }

  const refs = parseEntryList(input.refs, "refs", refSchema, warnings)
  if (refs !== undefined) data.refs = refs
  else if ("refs" in input && !Array.isArray(input.refs)) delete data.refs

  const assets = parseEntryList(input.assets, "assets", assetSchema, warnings)
  if (assets !== undefined) data.assets = assets
  else if ("assets" in input && !Array.isArray(input.assets)) delete data.assets

  const links = parseEntryList(input.links, "links", cardLinkSchema, warnings)
  if (links !== undefined) data.links = links
  else if ("links" in input && !Array.isArray(input.links)) delete data.links

  if (input.fields !== undefined) {
    if (!isPlainObject(input.fields)) {
      warnings.push("fields: expected object")
      delete data.fields
    }
  }

  const card = data as Card
  for (const key of CARD_DATE_KEYS) {
    const value = card[key]
    if (value != null) warnInvalidIso(warnings, key, value)
  }
  if (card.refs) {
    for (let i = 0; i < card.refs.length; i++) {
      const syncedAt = card.refs[i]?.syncedAt
      if (syncedAt != null) {
        warnInvalidIso(warnings, `refs[${i}].syncedAt`, syncedAt)
      }
    }
  }

  return { data: card, warnings }
}

const boardVersionSchema = z.literal(1)

/** Loosely validates board.yaml; bad columns are dropped with warnings. */
export function tolerantParseBoard(input: unknown): TolerantParseResult<Board> {
  const warnings: string[] = []
  if (!isPlainObject(input)) {
    return { data: null, warnings: ["(root): expected object"] }
  }

  if (input.version === undefined) {
    return { data: null, warnings: ["version: required"] }
  }
  const versionParsed = boardVersionSchema.safeParse(input.version)
  if (!versionParsed.success) {
    return {
      data: null,
      warnings: versionParsed.error.issues.map(
        (issue) => `version: ${issue.message}`
      ),
    }
  }

  if (input.columns === undefined) {
    return { data: null, warnings: ["columns: required"] }
  }
  const columns = parseEntryList(
    input.columns,
    "columns",
    boardColumnSchema,
    warnings
  )
  if (columns === undefined) {
    return { data: null, warnings }
  }
  if (columns.length === 0) {
    return { data: null, warnings: [...warnings, "columns: need at least one"] }
  }

  const data: Record<string, unknown> = {
    ...input,
    version: versionParsed.data,
    columns,
    face: [] as string[],
  }

  if (input.face !== undefined) {
    if (!Array.isArray(input.face)) {
      warnings.push("face: expected array")
    } else {
      const face: string[] = []
      for (let i = 0; i < input.face.length; i++) {
        const parsed = z.string().min(1).safeParse(input.face[i])
        if (parsed.success) face.push(parsed.data)
        else warnings.push(`face[${i}]: ${parsed.error.issues[0]?.message}`)
      }
      if (face.length > 2) {
        warnings.push("face: at most 2 entries; keeping first 2")
        data.face = face.slice(0, 2)
      } else {
        data.face = face
      }
    }
  }

  return { data: data as Board, warnings }
}
