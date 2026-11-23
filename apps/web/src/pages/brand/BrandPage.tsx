import { Link } from "react-router"
import { ChevronRight } from "lucide-react"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Page, PageSection, PageTitle } from "@/components/page"
import { MOCKUPS, type MockupGroup } from "./registry"

const GROUPS: MockupGroup[] = ["Foundations", "Work items", "Workflows"]

/** /brand: every mockup agents build from (DESIGN.md). */
export function BrandPage() {
  return (
    <Page crumbs={[{ label: "Brand" }]} data-testid="brand-page">
      <PageTitle
        title="Brand"
        description="Mockups and rules for the Flows UI. Open one to see it live with its rules. DESIGN.md holds the full guide."
      />
      {GROUPS.map((group) => {
        const items = MOCKUPS.filter((m) => m.group === group)
        if (items.length === 0) return null
        return (
          <PageSection key={group} title={group}>
            <div className="grid grid-cols-1 gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.id}
                  to={`/brand/${m.id}`}
                  data-testid={`brand-card-${m.id}`}
                  className="group flex h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="w-full flex-1 pt-0">
                    <div
                      aria-hidden
                      className="pointer-events-none flex h-28 shrink-0 items-start justify-center overflow-hidden border-b bg-muted/60 bg-dot-grid p-2"
                    >
                      <div className="origin-top scale-50">
                        <m.Component />
                      </div>
                    </div>
                    <CardHeader className="flex-1">
                      <CardTitle>{m.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {m.summary}
                      </CardDescription>
                      <CardAction>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </CardAction>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </PageSection>
        )
      })}
    </Page>
  )
}
