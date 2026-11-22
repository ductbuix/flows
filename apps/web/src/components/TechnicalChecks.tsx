import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

type Props = {
  /** Warnings to flag on the closed trigger. */
  warnings?: number
  "data-testid"?: string
  children: ReactNode
}

/** Closed-by-default "Technical checks" section for trust dialogs. */
export function TechnicalChecks({
  warnings = 0,
  "data-testid": testId,
  children,
}: Props) {
  return (
    <Collapsible data-testid={testId} className="flex flex-col gap-2">
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="group/tech w-fit px-1.5"
          />
        }
      >
        <ChevronRight
          data-icon="inline-start"
          className="transition-transform group-data-panel-open/tech:rotate-90"
        />
        Technical checks
        {warnings > 0 && (
          <Badge variant="outline">
            {warnings} {warnings === 1 ? "warning" : "warnings"}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-60">
          <div className="flex flex-col gap-2 text-sm">{children}</div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}
