import { useSyncExternalStore } from "react"
import {
  GENERIC_SKILLS,
  INITIAL_SKILLS,
  SOURCE_SKILLS,
  type Skill,
  type SourceSkill,
} from "./skills-data"

let skills: Skill[] = INITIAL_SKILLS
let sources: string[] = ["repo-team-skills"]
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = () => listeners.forEach((fn) => fn())

export const useSkills = () => useSyncExternalStore(subscribe, () => skills)
export const useSources = () => useSyncExternalStore(subscribe, () => sources)

export const skillsOf = (sourceId: string): SourceSkill[] =>
  SOURCE_SKILLS[sourceId] ?? GENERIC_SKILLS

export function addSource(id: string) {
  if (!sources.includes(id)) sources = [...sources, id]
  emit()
}
export function removeSource(id: string) {
  sources = sources.filter((s) => s !== id)
  emit()
}

/** Copies the skill out of the source at its current version, into .agents and .claude. */
export function installSkill(sourceId: string, slug: string, version: number) {
  const src = skillsOf(sourceId).find((s) => s.slug === slug)
  if (!src) return
  const copy: Skill = {
    ...src,
    scope: "workspace",
    dirs: [".agents", ".claude"],
    from: { sourceId, version },
  }
  skills = [
    ...skills.filter((s) => !(s.scope === "workspace" && s.slug === slug)),
    copy,
  ]
  emit()
}

export const uninstallSkill = (slug: string) => {
  skills = skills.filter(
    (s) => !(s.scope === "workspace" && s.slug === slug && s.from)
  )
  emit()
}

/** Which CLIs read a skill, and how. Home skills in .agents reach Claude only as a plugin. */
export function readers(
  skill: Skill,
  all: Skill[]
): { cursor: boolean; claude: string | null; note: string } {
  if (skill.problem)
    return {
      cursor: false,
      claude: null,
      note: "Not offered: it breaks the spec.",
    }
  if (skill.scope === "workspace")
    return {
      cursor: true,
      claude: skill.dirs.includes(".claude") ? skill.slug : null,
      note: skill.dirs.includes(".claude")
        ? "Both read it from the workspace."
        : "Claude Code reads only .claude/skills in the workspace.",
    }
  if (skill.dirs.includes(".claude"))
    return {
      cursor: true,
      claude: skill.slug,
      note: "Both read it from your home folder.",
    }
  const dup = all.some(
    (s) =>
      s !== skill &&
      s.slug === skill.slug &&
      (s.dirs.includes(".claude") ||
        (s.scope === "workspace" && s.dirs.includes(".claude")))
  )
  return dup
    ? {
        cursor: true,
        claude: null,
        note: "Claude skips it: the same name exists in a .claude folder.",
      }
    : {
        cursor: true,
        claude: `agents:${skill.slug}`,
        note: "Claude reaches it through a generated plugin named agents.",
      }
}
