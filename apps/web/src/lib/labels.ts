/** Readable labels for workflows, runs, times and durations (BL-059). */

export function humanizeId(id: string): string {
  const spaced = id.replace(/[-_]+/g, " ").trim()
  if (!spaced) return id
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** `name` when set, else "feature-spec" becomes "Feature spec" (BL-073). */
export function workflowLabel(summary: { id: string; name?: string }): string {
  const name = summary.name?.trim()
  return name ? name : humanizeId(summary.id)
}

/** Work item title when the run has one, else "Ad hoc run". */
export function runLabel(run: { cardTitle?: string | null }): string {
  const title = run.cardTitle?.trim()
  return title ? title : "Ad hoc run"
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "just now" under 45s, "3 min ago", "2 h ago", "yesterday", then a date. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso)
  const t = then.getTime()
  if (Number.isNaN(t)) return iso
  const diff = now - t
  if (diff < 45_000) return "just now"
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))} min ago`
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(then)) / DAY)
  if (days === 1) return "yesterday"
  const sameYear = then.getFullYear() === new Date(now).getFullYear()
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

/** Absolute local time with the zone, for tooltips. */
export function formatAbsolute(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
}

/** "45s", "3m 05s", "2h 10m". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`
}
