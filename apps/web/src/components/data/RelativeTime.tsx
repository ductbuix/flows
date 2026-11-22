import { useEffect, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { formatAbsolute, formatRelative } from "@/lib/labels"

/** Relative time with the absolute local time in a Tooltip; ticks every 30s. */
export function RelativeTime({
  value,
  className,
  "data-testid": testId,
}: {
  value: string
  className?: string
  "data-testid"?: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time dateTime={value} className={className} data-testid={testId} />
        }
      >
        {formatRelative(value, now)}
      </TooltipTrigger>
      <TooltipContent>{formatAbsolute(value)}</TooltipContent>
    </Tooltip>
  )
}
