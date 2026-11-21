import {
  removedTaskIds,
  taskInLiveRunErrorSchema,
  workflowConflictSchema,
  workflowDetailSchema,
  type Workflow,
  type WorkflowDetail,
} from "@workspace/shared"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { loadTaskMentions } from "./load-task-mentions"

type SaveArgs = {
  workflowId: string
  yaml: string
  hash: string
  beforeWorkflow: Workflow | null
}

type SaveOk = {
  ok: true
  detail: WorkflowDetail
}

type SaveConflict = {
  ok: false
  kind: "conflict"
  diskYaml: string
  diskHash: string
}

type SaveFail = {
  ok: false
  kind: "validation" | "live_run" | "error"
  detail?: WorkflowDetail
}

export type SaveResult = SaveOk | SaveConflict | SaveFail

export async function saveWorkflowEditor(args: SaveArgs): Promise<SaveResult> {
  const { workflowId, yaml, hash, beforeWorkflow } = args
  const res = await api.workflows[":workflowId"].$put({
    param: { workflowId },
    json: { yaml, baseHash: hash },
  })
  if (res.status === 409) {
    const raw: unknown = await res.json()
    const live = taskInLiveRunErrorSchema.safeParse(raw)
    if (live.success) {
      toast.error(
        `Cannot remove task(s) still used by live or queued run(s): ${live.data.runIds.join(", ")}`
      )
      return { ok: false, kind: "live_run" }
    }
    const body = workflowConflictSchema.parse(raw)
    return {
      ok: false,
      kind: "conflict",
      diskYaml: body.diskYaml,
      diskHash: body.diskHash,
    }
  }
  if (res.status === 400) {
    const detail = workflowDetailSchema.parse(await res.json())
    toast.error("Save failed: invalid YAML")
    return { ok: false, kind: "validation", detail }
  }
  if (!res.ok) {
    toast.error("Save failed")
    return { ok: false, kind: "error" }
  }
  const detail = workflowDetailSchema.parse(await res.json())
  toast.success("Saved")
  void warnMentionsAfterSave(workflowId, beforeWorkflow, detail.workflow)
  return { ok: true, detail }
}

async function warnMentionsAfterSave(
  workflowId: string,
  before: Workflow | null,
  after: Workflow | null
) {
  if (!before || !after) return
  const removed = removedTaskIds(before, after)
  if (removed.length === 0) return
  const labels: string[] = []
  for (const id of removed) {
    const hits = await loadTaskMentions(workflowId, after, id)
    for (const h of hits) labels.push(`${h.label} (${h.where})`)
  }
  if (labels.length > 0) {
    toast.warning(
      `Other tasks still mention a removed task: ${labels.join(", ")}`
    )
  }
}
