/**
 * Suggestion pattern (AI Elements, https://ui.shadcn.com/docs/ai-elements/base/suggestion).
 * A scrolling row of outline Buttons; clicking one hands its text back.
 */
import type { ComponentProps } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export function Suggestions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex gap-2 overflow-x-auto overscroll-x-contain", className)}
      {...props}
    />
  )
}

export function Suggestion({
  suggestion,
  onClick,
}: {
  suggestion: string
  onClick?: (suggestion: string) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => onClick?.(suggestion)}
    >
      {suggestion}
    </Button>
  )
}
