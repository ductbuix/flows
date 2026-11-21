import type { ReactNode } from "react"

type Props = {
  title: string
  children: ReactNode
}

/** Section: h2 plus content with gap-3 (DES-025). */
export function Section({ title, children }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-medium">{title}</h2>
      {children}
    </section>
  )
}
