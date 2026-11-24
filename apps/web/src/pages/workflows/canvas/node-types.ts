import { JudgeNode, StepNode } from "./FlowNodes"
import { ApprovalNode, AssetNode, OutputNode, TriggerNode } from "./FlowNodesIO"

/** React Flow nodeTypes keyed by registry kind. */
export const nodeTypes = {
  trigger: TriggerNode,
  prompt: StepNode,
  asset: AssetNode,
  agent: StepNode,
  command: StepNode,
  llm: StepNode,
  judge: JudgeNode,
  approval: ApprovalNode,
  output: OutputNode,
}
