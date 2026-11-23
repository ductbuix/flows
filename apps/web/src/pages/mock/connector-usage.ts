import { useFlowsVersion, useWorkflows, getFlow } from "./workflows-store"

export type StepUse = { workflowId: string; workflow: string; node: string; step: string }

/** Agent steps that list this connector, read from the canvases as they are now. */
export function useStepUses(connectorId: string): StepUse[] {
  useFlowsVersion()
  return useWorkflows().flatMap((w) =>
    getFlow(w.id)
      .nodes.filter((n) => n.type === "llm" && n.data.connectors?.includes(connectorId))
      .map((n) => ({
        workflowId: w.id,
        workflow: w.name,
        node: n.id,
        step: (n.data.prompt ?? "").split(/[.\n]/)[0]!.slice(0, 48) || n.id,
      }))
  )
}
