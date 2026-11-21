import {
  collectMentionHits,
  isAgentTask,
  taskPromptPath,
  workflowFileDetailSchema,
  type MentionHit,
  type Workflow,
} from "@workspace/shared"
import { api } from "@/lib/api"

/** Fetch agent prompts and collect mention hits for a pending remove. */
export async function loadTaskMentions(
  workflowId: string,
  workflow: Workflow,
  removedId: string
): Promise<MentionHit[]> {
  const prompts = new Map<string, string>()
  await Promise.all(
    workflow.tasks
      .filter((t) => t.id !== removedId && isAgentTask(t))
      .map(async (t) => {
        const path = taskPromptPath(t.id)
        const res = await api.workflows[":workflowId"].files[":path"].$get({
          param: { workflowId, path },
        })
        if (!res.ok) return
        const detail = workflowFileDetailSchema.parse(await res.json())
        prompts.set(t.id, detail.content)
      })
  )
  return collectMentionHits(workflow, removedId, prompts)
}
