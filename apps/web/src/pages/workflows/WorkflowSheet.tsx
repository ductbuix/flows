import type { WorkflowSummary } from "@workspace/contracts"
import {
  Sheet,
  SheetContent,
} from "@workspace/ui/components/sheet"
import { WorkflowSheetBody } from "./WorkflowSheetBody"

type Props = {
  workflow: WorkflowSummary | null
  onClose: () => void
  onRenamedId?: (newId: string) => void
}

export function WorkflowSheet({ workflow, onClose, onRenamedId }: Props) {
  return (
    <Sheet open={!!workflow} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="data-[side=right]:sm:max-w-lg"
        data-testid="workflow-sheet"
      >
        {workflow ? (
          <WorkflowSheetBody
            key={workflow.id}
            workflow={workflow}
            onClose={onClose}
            onRenamedId={onRenamedId}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
