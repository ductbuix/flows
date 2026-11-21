import { EFFORTS, type CliModelEntry, type Effort } from "@workspace/shared"

const EFFORT_SET = new Set<string>(EFFORTS)

export type ListedCursorModel = {
  id: string
  label: string
}

type FamilyMember = {
  id: string
  effort?: Effort
  fast: boolean
}

/**
 * Parse `agent --list-models` lines into family ids and efforts (DES-023).
 * Prefers non-fast ids when composing later.
 */
export function parseCursorModelList(
  lines: ListedCursorModel[]
): CliModelEntry[] {
  const families = new Map<string, { label: string; members: FamilyMember[] }>()

  for (const line of lines) {
    const parsed = parseCursorModelId(line.id)
    const existing = families.get(parsed.familyId)
    if (existing) {
      existing.members.push(parsed)
      if (!parsed.effort && !parsed.fast)
        existing.label = cleanLabel(line.label)
    } else {
      families.set(parsed.familyId, {
        label: cleanLabel(line.label),
        members: [parsed],
      })
    }
  }

  const out: CliModelEntry[] = []
  for (const [id, fam] of families) {
    const efforts = new Set<Effort>()
    for (const m of fam.members) {
      if (m.effort && !m.fast) efforts.add(m.effort)
    }
    // Fast-only efforts are not offered; bare family still listed.
    out.push({
      id,
      label: fam.label || id,
      efforts: EFFORTS.filter((e) => efforts.has(e)),
    })
  }
  return out
}

export function parseCursorModelId(id: string): FamilyMember & {
  familyId: string
} {
  let rest = id
  let fast = false
  if (rest.endsWith("-fast")) {
    fast = true
    rest = rest.slice(0, -"-fast".length)
  }
  for (const effort of EFFORTS) {
    const suffix = `-${effort}`
    if (rest.endsWith(suffix)) {
      return {
        familyId: rest.slice(0, -suffix.length),
        id,
        effort,
        fast,
      }
    }
  }
  return { familyId: rest, id, fast }
}

/** Prefer non-fast id for family+effort; fall back to fast-only. */
export function composeCursorModelId(
  familyId: string,
  effort: Effort | undefined,
  listedIds: readonly string[]
): string {
  const base = effort ? `${familyId}-${effort}` : familyId
  if (listedIds.includes(base)) return base
  const fast = `${base}-fast`
  if (listedIds.includes(fast)) return fast
  return base
}

function cleanLabel(label: string): string {
  let out = label.trim()
  for (const effort of [...EFFORTS].reverse()) {
    const re = new RegExp(`\\s+${effort}\\b`, "i")
    out = out.replace(re, "")
  }
  out = out
    .replace(/\s+Fast\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
  return out || label.trim()
}

export function isEffort(value: string): value is Effort {
  return EFFORT_SET.has(value)
}
