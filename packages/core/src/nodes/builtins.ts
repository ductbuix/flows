import { createNodeKindRegistry, type NodeKindRegistry } from "./registry.ts"
import { agentKind } from "./kinds/agent.ts"
import { approvalKind } from "./kinds/approval.ts"
import { assetKind } from "./kinds/asset.ts"
import { conditionKind } from "./kinds/condition.ts"
import { judgeCheckKind } from "./kinds/judge-check.ts"
import { llmKind } from "./kinds/llm.ts"
import { notifyKind } from "./kinds/notify.ts"
import { promptKind } from "./kinds/prompt.ts"
import { triggerKind } from "./kinds/trigger.ts"
import type { NodeKind } from "./types.ts"

/** Built-in kinds ported in BL-134 / BL-135 / BL-142 / BL-143 / BL-195. */
export const CORE_NODE_KINDS: readonly NodeKind[] = [
  triggerKind,
  promptKind,
  assetKind,
  agentKind,
  llmKind,
  conditionKind,
  judgeCheckKind,
  approvalKind,
  notifyKind,
]

export function createCoreNodeRegistry(
  extra: readonly NodeKind[] = []
): NodeKindRegistry {
  return createNodeKindRegistry([...CORE_NODE_KINDS, ...extra])
}
