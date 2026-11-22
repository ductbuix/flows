import type { ReactNode } from "react"

type Props = {
  title: string
  description: ReactNode
  badge?: ReactNode
}

/** Page title block: h1, one muted sentence, optional Badge (DES-027). */
export function PageTitle({ title, description, badge }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-xl font-medium">{title}</h1>
        {badge}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        {description}
      </div>
    </div>
  )
}
