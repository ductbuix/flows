import type { WireSkillSummary } from "@workspace/contracts"
import type { Tone } from "@/components/brand/StatusPill"

/** Install / validity label for a catalog row (no Library version check yet). */
export function statusOf(s: WireSkillSummary): { tone: Tone; label: string } {
  if (s.problem) return { tone: "failed", label: "Invalid" }
  if (!s.from) return { tone: "idle", label: "Read-only" }
  return { tone: "done", label: `Installed v${s.from.version}` }
}

export function whereLabel(s: WireSkillSummary): string {
  const root = s.scope === "home" ? "~" : "."
  return `${root}/${s.dirs.map((d) => `${d}`).join(" + ")}/skills`
}
