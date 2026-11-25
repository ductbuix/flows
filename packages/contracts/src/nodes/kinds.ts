import { z } from "zod"
import { agentKind } from "./agent.ts"
import { approvalKind } from "./approval.ts"
import { assetKind } from "./asset.ts"
import { commandKind } from "./command.ts"
import { judgeKind } from "./judge.ts"
import { llmKind } from "./llm.ts"
import { outputKind } from "./output.ts"
import { promptKind } from "./prompt.ts"
import { triggerKind } from "./trigger.ts"

/** The one list of kinds; schema, ports and checks read it (DES-035). */
export const NODE_KINDS = [
  triggerKind,
  promptKind,
  assetKind,
  agentKind,
  commandKind,
  llmKind,
  judgeKind,
  approvalKind,
  outputKind,
] as const

export type NodeKindName = (typeof NODE_KINDS)[number]["kind"]

export const nodeSchema = z.discriminatedUnion(
  "kind",
  NODE_KINDS.map((k) => k.schema) as unknown as [
    (typeof NODE_KINDS)[number]["schema"],
    ...(typeof NODE_KINDS)[number]["schema"][],
  ]
)

export type WorkflowNode = z.infer<typeof nodeSchema>
