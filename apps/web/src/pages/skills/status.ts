import type { WireSkillSummary } from "@workspace/contracts"
import type { Tone } from "@/components/brand/StatusPill"

/** Install / validity label; `sourceCurrent` is the Library item's current version. */
export function statusOf(
  s: WireSkillSummary,
  sourceCurrent?: number
): { tone: Tone; label: string } {
  if (s.problem) return { tone: "failed", label: "Invalid" }
  if (!s.from) return { tone: "idle", label: "Read-only" }
  const cur = sourceCurrent ?? s.from.version
  if (cur > s.from.version) {
    return { tone: "attention", label: "Update available" }
  }
  return { tone: "done", label: `Installed v${s.from.version}` }
}

export function whereLabel(s: WireSkillSummary): string {
  const root = s.scope === "home" ? "~" : "."
  return `${root}/${s.dirs.map((d) => `${d}`).join(" + ")}/skills`
}
