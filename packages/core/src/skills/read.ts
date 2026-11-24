import {
  SkillSlug,
  skillGetMethod,
  skillListMethod,
  type WireSkillDetail,
  type WireSkillSummary,
} from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { SkillCatalog, SkillDetail, SkillSummary } from "./catalog.ts"
import { parseSkillKey, skillKey } from "./paths.ts"

const DEFAULT_LIST_LIMIT = 100

export type SkillReadDeps = {
  catalog: SkillCatalog
}

export type SkillReadBindings = Pick<MethodBindings, "skill/list" | "skill/get">

export function createSkillReadBindings(
  deps: SkillReadDeps
): SkillReadBindings {
  return {
    "skill/list": defineBinding(skillListMethod, (params) =>
      listSkills(deps.catalog.list(), params.cursor, params.limit)
    ),
    "skill/get": defineBinding(skillGetMethod, (params) => {
      const entry = deps.catalog.get(params.scope, params.slug)
      if (!entry) {
        throw engineError(
          "not_found",
          `Skill not found: ${params.scope}/${params.slug}`
        )
      }
      return toWireDetail(entry)
    }),
  }
}

function listSkills(
  skills: SkillSummary[],
  cursor?: string,
  limit = DEFAULT_LIST_LIMIT
): { items: WireSkillSummary[]; next?: string } {
  const sorted = [...skills].sort((a, b) =>
    skillKey(a.scope, a.slug).localeCompare(skillKey(b.scope, b.slug))
  )
  let start = 0
  if (cursor) {
    const parsed = parseSkillKey(cursor)
    const at = parsed
      ? sorted.findIndex(
          (s) => s.scope === parsed.scope && s.slug === parsed.slug
        )
      : -1
    start = at === -1 ? 0 : at + 1
  }
  const page = sorted.slice(start, start + limit).map(toWireSummary)
  const hasMore = start + limit < sorted.length
  const last = page[page.length - 1]
  const next = hasMore && last ? skillKey(last.scope, last.slug) : undefined
  return { items: page, next }
}

function toWireSummary(entry: SkillSummary): WireSkillSummary {
  return {
    slug: SkillSlug.parse(entry.slug),
    name: entry.name,
    description: entry.description,
    scope: entry.scope,
    dirs: entry.dirs,
    ...(entry.from !== undefined ? { from: entry.from } : {}),
    problem: entry.problem,
  }
}

function toWireDetail(entry: SkillDetail): WireSkillDetail {
  return { ...toWireSummary(entry), body: entry.body }
}
