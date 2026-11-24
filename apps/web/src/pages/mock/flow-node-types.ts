import { ApprovalNode, AssetNode, OutputNode, TriggerNode } from "./FlowNodesIO"
import { ConditionNode, LlmNode } from "./FlowNodes"

export const nodeTypes = {
  trigger: TriggerNode,
  asset: AssetNode,
  llm: LlmNode,
  condition: ConditionNode,
  approval: ApprovalNode,
  notify: OutputNode,
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const portOf = (h?: string | null) => (h === "image" ? "image" : "text")
