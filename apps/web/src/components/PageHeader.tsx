import { Fragment, type ReactNode } from "react"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Link } from "react-router"

export type Crumb = {
  label: string
  to?: string
}

type Props = {
  crumbs: Crumb[]
  actions?: ReactNode
}

/** Shared page header: trigger, separator, breadcrumb, optional actions. */
export function PageHeader({ crumbs, actions }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger data-testid="sidebar-trigger" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {i === crumbs.length - 1 || !crumb.to ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={crumb.to} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
