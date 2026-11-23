import { useLocation } from "react-router"
import { Page } from "@/components/page"

/** Blank canvas for iterating on UX; the breadcrumb shows the open item. */
export function MockBlankPage() {
  const { pathname } = useLocation()
  const title = pathname.endsWith("/workflows")
    ? "Workflows"
    : pathname.endsWith("/docket")
      ? "Docket"
      : null
  const crumbs = [{ label: "Mockup", to: "/mock" }]
  if (title) crumbs.push({ label: title, to: pathname })
  return (
    <Page crumbs={crumbs} data-testid="mock-page">
      {null}
    </Page>
  )
}
