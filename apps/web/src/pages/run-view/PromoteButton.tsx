import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { api } from "@/lib/api"

type Props = {
  runId: string
  taskId: string
}

export function PromoteButton({ runId, taskId }: Props) {
  return (
    <Button
      data-testid={`promote-${taskId}`}
      onClick={() => {
        void (async () => {
          const res = await api.runs[":runId"].tasks[":taskId"].promote.$post({
            param: { runId, taskId },
          })
          if (!res.ok) {
            toast.error("Promote failed")
            return
          }
          toast.success(`Promoted ${taskId} into workflow.yaml`)
        })()
      }}
    >
      Promote into workflow.yaml
    </Button>
  )
}
