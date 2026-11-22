import type { ReactNode } from "react"

/** One row of controls for a section or tab. */
export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>
}
