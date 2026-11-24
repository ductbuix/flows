import { fillTemplate } from "@workspace/contracts"
import { z } from "zod"
import { defineNodeKind } from "../define.ts"
import type { StepContext, StepEvent } from "../types.ts"

const settings = z.object({
  question: z.string().min(1),
})

type Settings = z.infer<typeof settings>

/**
 * Approval: ask via inbox, then finish on approve (DES-032 / DES-041).
 * Nodes after it read the gated results by reference (DES-034).
 * Reject is handled by the actor (`answer` → `step_rejected`); execute is not
 * re-entered after a reject.
 */
export const approvalKind = defineNodeKind({
  kind: "approval",
  settings,
  ports: { in: ["text", "file"], out: ["text", "file"] },
  async *execute(ctx: StepContext<Settings>): AsyncIterable<StepEvent> {
    if (ctx.decision === "approved") {
      yield { kind: "done" }
      return
    }
    const question = fillTemplate(ctx.settings.question, ctx.answers)
    const decision = await ctx.inbox.ask(question)
    if (decision === "approved") {
      yield { kind: "done" }
      return
    }
    yield { kind: "waiting", question }
  },
})
