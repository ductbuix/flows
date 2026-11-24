import { Bot } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Page, PageTitle } from "@/components/page"
import { errorMessage } from "@/lib/fcp-error"

const crumbs = [{ label: "Mockup", to: "/mock" }, { label: "Skills" }] as const

export function SkillsLoading() {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="mock-skills-page">
      <PageTitle title="Skills" description="Loading skills…" />
      <div className="flex flex-col gap-3" data-testid="skills-loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    </Page>
  )
}

export function SkillsLoadError({ error }: { error: unknown }) {
  return (
    <Page fill crumbs={[...crumbs]} data-testid="mock-skills-page">
      <PageTitle title="Skills" description="Could not load skills." />
      <Alert variant="destructive" data-testid="skills-error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    </Page>
  )
}

export function SkillsEmpty() {
  return (
    <Empty data-testid="skills-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Bot />
        </EmptyMedia>
        <EmptyTitle>No skills on this machine</EmptyTitle>
        <EmptyDescription>
          Drop a SKILL.md folder under .agents, .claude or .cursor, or install
          from a source when Library sources are available.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
