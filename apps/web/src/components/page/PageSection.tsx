import type { ReactNode } from "react"
import { PageToolbar } from "./PageToolbar"

type Props = {
  title: string
  /** Section actions, shown at the right of the h2. */
  toolbar?: ReactNode
  children: ReactNode
}

/** Section: h2 row (min-h-8) plus content with gap-3 (DES-027). */
export function PageSection({ title, toolbar, children }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        {toolbar ? <PageToolbar>{toolbar}</PageToolbar> : null}
      </div>
      {children}
    </section>
  )
}
