import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { answerText, parseAnswerText, type AgentTask } from "@workspace/shared"
import { resolveAttemptModelFields } from "../attempt-model.ts"
import { buildAgentShellCommand, copyTaskMemories } from "../agents.ts"
import { writeCursorTrustMarker } from "../cursor-trust.ts"
import {
  agentAnswerPrompt,
  agentFixPrompt,
  filledFile,
  nodeAnswers,
  pendingAnswerFix,
  settleAnswer,
} from "./answers.ts"
import { defineExecutor } from "./define.ts"
import { readOptional, settleProcessOutput } from "./process.ts"

/** Agent CLI step: launches the CLI from the frozen `prompt.md` (DES-034). */
export const agentExecutor = defineExecutor({
  kind: "agent",
  run(ctx) {
    const node = ctx.node
    if (node.kind !== "agent") throw new Error("not an agent node")
    if (!existsSync(ctx.frozenPath("prompt.md"))) throw new Error("missing_prompt")
    const decls = nodeAnswers(ctx)
    // The task text, filled and with the answer request, lives in the attempt.
    const instructionsOf = (attemptRoot: string) =>
      join(attemptRoot, "input", "prompt.md")
    const task: AgentTask = {
      id: node.id,
      needs: [],
      kind: "agent",
      cli: node.cli,
      ...(node.model !== undefined ? { model: node.model } : {}),
      ...(node.effort !== undefined ? { effort: node.effort } : {}),
      ...(node.memory !== undefined ? { memory: node.memory } : {}),
    }
    return {
      launch: {
        agent: true,
        cli: node.cli,
        instructions: instructionsOf,
        modelFields: resolveAttemptModelFields(task, ctx.graph),
        prepare({ attemptRoot, inputDir }) {
          const fix = pendingAnswerFix(attemptRoot)
          const parts = [filledFile(ctx, "prompt.md") ?? ""]
          if (decls.length > 0) parts.push(agentAnswerPrompt(decls))
          if (fix) {
            parts.push(agentFixPrompt(fix.error))
            mkdirSync(join(attemptRoot, "out"), { recursive: true })
            cpSync(join(fix.previous, "out"), join(attemptRoot, "out"), {
              recursive: true,
            })
          }
          writeFileSync(instructionsOf(attemptRoot), parts.join("\n\n"))
          copyTaskMemories(task, ctx.workflowRoot, inputDir)
          if (node.cli === "cursor") {
            writeCursorTrustMarker(ctx.workflowRoot)
            writeCursorTrustMarker(attemptRoot)
          }
        },
        command({ attemptRoot }) {
          return {
            shell: buildAgentShellCommand(
              task,
              instructionsOf(attemptRoot),
              { workflowRoot: ctx.workflowRoot, attemptRoot },
              ctx.graph.agent
            ),
            cwd: "attempt",
            allowCursorHome: node.cli === "cursor",
          }
        },
      },
    }
  },
  finish(ctx, attemptRoot) {
    const decls = nodeAnswers(ctx)
    const raw = readOptional(join(attemptRoot, "out", "answer.json"))
    const text =
      readOptional(join(attemptRoot, "SUMMARY.md")) ??
      readOptional(join(attemptRoot, "stdout.log")) ??
      ""
    if (decls.length > 0) {
      const found = parseAnswerText(decls, raw ?? "")
      const settled = settleAnswer(attemptRoot, decls, found, { outputs: [] })
      if (!found.ok) return settled
      const done = settleProcessOutput(
        ctx,
        attemptRoot,
        answerText(decls, found.value)
      )
      return { ...done, answer: found.value }
    }
    const result = settleProcessOutput(ctx, attemptRoot, text)
    if (raw !== undefined) {
      try {
        const answer: unknown = JSON.parse(raw)
        if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
          result.answer = answer as Record<string, unknown>
        }
      } catch {
        /* nothing is declared, so an unreadable answer is ignored */
      }
    }
    return result
  },
})
