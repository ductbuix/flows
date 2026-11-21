import type { ReactNode } from "react"

type Props = {
  title: string
  description: string
  badge?: ReactNode
}

/** Page title block: heading, one muted sentence, optional Badge (DES-025). */
export function PageTitle({ title, description, badge }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-xl font-medium">{title}</h1>
        {badge}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
