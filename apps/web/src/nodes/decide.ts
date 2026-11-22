import { toast } from "sonner"
import { approveTask, rejectTask } from "@/lib/run-actions"

export type Decision = "approve" | "reject"

/** Approve or Reject a waiting Approval step of a run (BL-080). */
export function decideStep(runId: string, nodeId: string, decision: Decision) {
  const act = decision === "approve" ? approveTask : rejectTask
  void act(runId, nodeId).then((r) => {
    if (!r.ok) toast.error(r.error)
  })
}
