import { cn } from "@workspace/ui/lib/utils"
import { mono } from "@/components/data/mono"

export type Stat = { label: string; value: string }

/**
 * Footer stats: muted label over a mono value, split by hairlines. No shadcn
 * part covers this; keep it this small.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex items-stretch">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={cn(
            "flex flex-col gap-0.5 px-4",
            i > 0 ? "border-l" : "pl-0"
          )}
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className={cn(mono, "text-base tabular-nums")}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
