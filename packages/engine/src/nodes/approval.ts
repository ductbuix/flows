import { fillTemplate } from "@workspace/shared"
import { defineExecutor } from "./define.ts"
import { forwardInputs, joinedInputText } from "./forward.ts"

/**
 * Approval (DES-032, DES-034): the step asks its question and waits with
 * no slot. Approve forwards the input; Reject ends the run, which the
 * engine does (`rejectNodeStep`).
 */
export const approvalExecutor = defineExecutor({
  kind: "approval",
  run(ctx) {
    if (ctx.node.kind !== "approval") throw new Error("not an approval node")
    return { wait: { question: fillTemplate(ctx.node.question, ctx.answers) } }
  },
  approved(ctx) {
    return { outputs: forwardInputs(ctx, joinedInputText(ctx)) }
  },
})
