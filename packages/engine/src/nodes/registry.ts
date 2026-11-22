import type { NodeExecutor } from "./define.ts"
import { agentExecutor } from "./agent.ts"
import { approvalExecutor } from "./approval.ts"
import { commandExecutor } from "./command.ts"
import { judgeExecutor } from "./judge.ts"
import { outputExecutor } from "./output.ts"
import { promptExecutor } from "./prompt.ts"
import { triggerExecutor } from "./trigger.ts"

/** The one list of executors; the scheduler has no kind branches. */
export const EXECUTORS: readonly NodeExecutor[] = [
  triggerExecutor,
  promptExecutor,
  agentExecutor,
  commandExecutor,
  judgeExecutor,
  approvalExecutor,
  outputExecutor,
]

export function executorFor(kind: string): NodeExecutor | undefined {
  return EXECUTORS.find((e) => e.kind === kind)
}
