import { CommandNode, JudgeNode, LlmNode, PromptNode } from "./FlowNodes"
import { ApprovalNode, AssetNode, OutputNode, TriggerNode } from "./FlowNodesIO"

/** React Flow nodeTypes keyed by `nodeTypeOf(kind)`. */
export const nodeTypes = {
  "flow-trigger": TriggerNode,
  "flow-prompt": PromptNode,
  "flow-asset": AssetNode,
  "flow-agent": LlmNode,
  "flow-command": CommandNode,
  "flow-llm": LlmNode,
  "flow-judge": JudgeNode,
  "flow-approval": ApprovalNode,
  "flow-output": OutputNode,
}
