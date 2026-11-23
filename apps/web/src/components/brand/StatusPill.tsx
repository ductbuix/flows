import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { Check, CircleAlert, CircleX, Clock } from "lucide-react"

export type Tone = "working" | "done" | "failed" | "attention" | "idle"

/** Tinted surface + text per tone. The only place tones map to colors. */
export const TONE_CLASS: Record<Tone, string> = {
  working: "border-info/25 bg-info/10 text-info",
  done: "border-success/25 bg-success/10 text-success",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
  attention: "border-warning/30 bg-warning/15 text-foreground",
  idle: "border-border bg-muted text-muted-foreground",
}

/** Text-only color per tone, for step results and connector lines. */
export const TONE_TEXT: Record<Tone, string> = {
  working: "text-info",
  done: "text-success",
  failed: "text-destructive",
  attention: "text-warning",
  idle: "text-muted-foreground",
}

function ToneIcon({ tone }: { tone: Tone }) {
  switch (tone) {
    case "working":
      return (
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-current"
        />
      )
    case "done":
      return <Check />
    case "failed":
      return <CircleX />
    case "attention":
      return <CircleAlert className="text-warning" />
    case "idle":
      return <Clock />
  }
}

type Props = {
  tone: Tone
  children: React.ReactNode
  className?: string
  "data-testid"?: string
}

/**
 * Status pill (DESIGN.md: Status). Short sentence-case label, icon first,
 * tinted by tone. One per row or header; never two tones side by side.
 */
export function StatusPill({
  tone,
  children,
  className,
  "data-testid": testId,
}: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(TONE_CLASS[tone], className)}
      data-tone={tone}
      data-testid={testId}
    >
      <ToneIcon tone={tone} />
      {children}
    </Badge>
  )
}
