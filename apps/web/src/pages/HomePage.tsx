import { FolderOpen } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { PageHeader } from "@/components/PageHeader"
import { useWorkflows } from "@/lib/workflows-context"

export function HomePage() {
  const { workflows, error } = useWorkflows()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader crumbs={[{ label: "Workflows" }]} />
      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !workflows ? (
          <div className="w-full max-w-sm space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Empty data-testid="home-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle>Select a workflow or create one</EmptyTitle>
              <EmptyDescription>
                Pick a workflow from the sidebar, or use the plus action to
                create a new one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        )}
      </div>
    </div>
  )
}
