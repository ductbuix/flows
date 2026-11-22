import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { PageHeader, type Crumb } from "./PageHeader"

type Props = {
  crumbs: Crumb[]
  actions?: ReactNode
  /** Last region takes the remaining height (Editor, Run view). */
  fill?: boolean
  "data-testid"?: string
  children: ReactNode
}

/**
 * The one page frame (DES-027): header plus the content stack. Content is
 * `px-4 lg:px-6`; a child marked `data-bleed` spans the full width. With
 * `fill`, give the last region `min-h-0 flex-1` (plus a
 * `min-h-*` when the content above is tall); the page scrolls if it must.
 */
export function Page({
  crumbs,
  actions,
  fill,
  "data-testid": testId,
  children,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={testId}>
      <PageHeader crumbs={crumbs} actions={actions} />
      <div
        className={cn(
          "@container/main flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6",
          "[&>[data-bleed]]:-mx-4 lg:[&>[data-bleed]]:-mx-6",
          "overflow-auto",
          fill && "min-h-0"
        )}
      >
        {children}
      </div>
    </div>
  )
}
