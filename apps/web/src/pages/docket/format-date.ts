const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "2026-11-28" or ISO datetime -> "Nov 28, 2026" (no Date API). */
export function formatDate(iso: string): string {
  const day = iso.slice(0, 10)
  const [y, m, d] = day.split("-")
  if (!y || !m || !d) return iso
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`
}
