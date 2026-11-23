import { Circle, CircleCheck, CircleDot, CircleEllipsis } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { TONE_TEXT } from "@/components/brand/StatusPill"
import type { Column, Tone } from "./docket-data"

const ICON = {
  idle: Circle,
  working: CircleDot,
  attention: CircleEllipsis,
  done: CircleCheck,
} satisfies Record<Tone, typeof Circle>

/** Lane tint per tone: flat, no shadow (DESIGN.md Shape and depth). */
export const LANE_BG: Record<Tone, string> = {
  idle: "bg-muted/60",
  working: "bg-info/5",
  attention: "bg-warning/10",
  done: "bg-success/5",
}

export function ColumnHeader({ col, count }: { col: Column; count: number }) {
  const Icon = ICON[col.tone]
  return (
    <div
      className={`flex items-center gap-2 px-1 text-sm font-medium ${TONE_TEXT[col.tone]}`}
    >
      <Icon className="size-4" />
      {col.label}
      <Badge variant="outline" className="bg-card text-foreground tabular-nums">
        {String(count).padStart(2, "0")}
      </Badge>
    </div>
  )
}
