import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { runSummarySchema } from "@workspace/shared"
import { api } from "@/lib/api"

type Props = {
  workflowId: string
  onRename: () => void
  onDelete: () => void
}

function LiveAwareButton({
  live,
  testId,
  label,
  onClick,
}: {
  live: boolean
  testId: string
  label: string
  onClick: () => void
}) {
  const button = (
    <Button
      size="sm"
      variant="outline"
      data-testid={testId}
      disabled={live}
      onClick={onClick}
    >
      {label}
    </Button>
  )
  if (!live) return button
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {button}
      </TooltipTrigger>
      <TooltipContent>
        Blocked while a run of this workflow is live.
      </TooltipContent>
    </Tooltip>
  )
}

export function WorkflowActions({ workflowId, onRename, onDelete }: Props) {
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const res = await api.workflows[":workflowId"].runs.$get({
        param: { workflowId },
      })
      if (!res.ok || !alive) return
      const runs = runSummarySchema.array().parse(await res.json())
      if (alive)
        setLive(
          runs.some((r) => r.status === "running" || r.status === "queued")
        )
    })()
    return () => {
      alive = false
    }
  }, [workflowId])

  return (
    <TooltipProvider>
      <div className="flex gap-1">
        <LiveAwareButton
          live={live}
          testId={`workflow-rename-open-${workflowId}`}
          label="Rename"
          onClick={onRename}
        />
        <LiveAwareButton
          live={live}
          testId={`workflow-delete-open-${workflowId}`}
          label="Delete"
          onClick={onDelete}
        />
      </div>
    </TooltipProvider>
  )
}
