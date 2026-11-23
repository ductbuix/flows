export const SKILL_DIRS = [".agents", ".claude", ".cursor"] as const
export type SkillDir = (typeof SKILL_DIRS)[number]

export type SkillScope = "workspace" | "home"

/** Globs relative to a workspace or home root (DES-041). */
export const SKILL_GLOBS = SKILL_DIRS.map(
  (dir) => `${dir}/skills/**/SKILL.md`
) as readonly string[]

const SKILL_PATH_RE =
  /^\.(agents|claude|cursor)\/skills\/(?:.+\/)?([^/]+)\/SKILL\.md$/i

export function normSkillPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\//, "")
}

export function skillDirFromPath(path: string): SkillDir | null {
  const m = SKILL_PATH_RE.exec(normSkillPath(path))
  if (!m) return null
  return `.${m[1]!.toLowerCase()}` as SkillDir
}

export function skillSlugFromPath(path: string): string | null {
  return SKILL_PATH_RE.exec(normSkillPath(path))?.[2] ?? null
}

export function skillKey(scope: SkillScope, slug: string): string {
  return `${scope}/${slug}`
}

export function parseSkillKey(
  key: string
): { scope: SkillScope; slug: string } | null {
  const slash = key.indexOf("/")
  if (slash <= 0) return null
  const scope = key.slice(0, slash)
  const slug = key.slice(slash + 1)
  if (scope !== "workspace" && scope !== "home") return null
  if (!slug) return null
  return { scope, slug }
}
