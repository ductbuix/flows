import type { WireSkillSummary } from "@workspace/contracts"

/** Which CLIs read a skill, and how (mockup / DES-041). */
export function readers(
  skill: WireSkillSummary,
  all: WireSkillSummary[]
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
