import { getFlow, useFlowsVersion, useWorkflows } from "./workflows-store"

export type SkillUse = {
  workflowId: string
  workflow: string
  node: string
  step: string
}

/** Agent steps that list this skill, read from the canvases as they are now. */
export function useSkillUses(slug: string): SkillUse[] {
  useFlowsVersion()
  return useWorkflows().flatMap((w) =>
    getFlow(w.id)
      .nodes.filter((n) => n.type === "llm" && n.data.skills?.includes(slug))
      .map((n) => ({
        workflowId: w.id,
        workflow: w.name,
        node: n.id,
        step: (n.data.prompt ?? "").split(/[.\n]/)[0]!.slice(0, 48) || n.id,
      }))
  )
}
