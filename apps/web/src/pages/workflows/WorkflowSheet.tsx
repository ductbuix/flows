import { Workflow } from "lucide-react"
import { Link } from "react-router"
import type { WorkflowSummary } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { workflowLabel } from "@/lib/labels"

type Props = {
  workflow: WorkflowSummary | null
  onClose: () => void
}

export function WorkflowSheet({ workflow, onClose }: Props) {
  return (
    <Sheet open={!!workflow} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="workflow-sheet"
      >
        {workflow ? (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>{workflowLabel(workflow)}</SheetTitle>
              <SheetDescription>
                {workflow.id}
                {workflow.goal ? ` · Solves: ${workflow.goal}` : null}
              </SheetDescription>
              <Button
                variant="outline"
                className="mt-2 w-fit"
                nativeButton={false}
                render={<Link to={`/mock/workflows/${workflow.id}`} />}
                data-testid="workflow-open-editor"
              >
                <Workflow />
                Open editor
              </Button>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t p-4">
              <p className="text-sm text-muted-foreground">
                {workflow.taskCount}{" "}
                {workflow.taskCount === 1 ? "task" : "tasks"} in this workflow.
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
