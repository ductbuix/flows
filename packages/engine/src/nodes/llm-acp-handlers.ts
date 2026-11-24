import {
  askQuestionResult,
  createPlanResult,
  decidePermission,
  parseAskQuestionParams,
  parseCreatePlanParams,
  resolvePlanReview,
  selectedPermissionResult,
  toolFromPermissionParams,
  type AcpInboxGates,
  type PermissionContext,
} from "@workspace/core"

export type AcpStepAskContext = {
  runId: string
  nodeId: string
  pass: number
  attemptRoot: string
  planReview?: "auto" | "ask"
  gates: AcpInboxGates
}

/** Wire ACP client-request handlers that park in the Inbox (BL-192). */
export function acpSessionHandlers(ctx: AcpStepAskContext) {
  const policy: PermissionContext = {
    allowedRoots: [ctx.attemptRoot],
    connectorWriteEnabled: true,
    nodeAllowlist: [],
    rememberedAllowAlways: [],
  }

  return {
    handlePermission: async (params: unknown) => {
      const fromParams = toolFromPermissionParams(params)
      const decision = decidePermission(
        { tool: fromParams.tool, toolKind: fromParams.toolKind },
        policy
      )
      if (decision.outcome !== "ask") {
        const optionId =
          decision.outcome === "reject"
            ? "reject-once"
            : decision.outcome === "allow_once"
              ? "allow-once"
              : "allow-always"
        return selectedPermissionResult(optionId)
      }
      const optionId = await ctx.gates.permission.ask({
        runId: ctx.runId,
        nodeId: ctx.nodeId,
        pass: ctx.pass,
        tool: fromParams.tool,
        requestId: fromParams.requestId,
        question: fromParams.question,
      })
      return selectedPermissionResult(optionId)
    },
    handleAskQuestion: async (params: unknown) => {
      const parsed = parseAskQuestionParams(params)
      if (!parsed) throw new Error("bad ask_question params")
      const result = await ctx.gates.question.ask({
        runId: ctx.runId,
        nodeId: ctx.nodeId,
        pass: ctx.pass,
        requestId: parsed.requestId,
        questions: parsed.questions,
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      })
      return askQuestionResult(result.outcome, result.answers, result.reason)
    },
    handleCreatePlan: async (params: unknown) => {
      const parsed = parseCreatePlanParams(params)
      if (!parsed) throw new Error("bad create_plan params")
      if (resolvePlanReview(ctx.planReview) === "auto") {
        return createPlanResult("accepted")
      }
      const result = await ctx.gates.planReview.ask({
        runId: ctx.runId,
        nodeId: ctx.nodeId,
        pass: ctx.pass,
        requestId: parsed.requestId,
        plan: parsed.plan,
        todos: parsed.todos,
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.overview !== undefined ? { overview: parsed.overview } : {}),
      })
      return createPlanResult(result.outcome, result.reason)
    },
  }
}
