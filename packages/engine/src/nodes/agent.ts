import { existsSync } from "node:fs"
import { join } from "node:path"
import type { AgentTask } from "@workspace/shared"
import { resolveAttemptModelFields } from "../attempt-model.ts"
import { buildAgentShellCommand, copyTaskMemories } from "../agents.ts"
import { writeCursorTrustMarker } from "../cursor-trust.ts"
import { defineExecutor } from "./define.ts"
import { readOptional, settleProcessOutput } from "./process.ts"

/** Agent CLI step: launches the CLI from the frozen `prompt.md` (DES-034). */
export const agentExecutor = defineExecutor({
  kind: "agent",
  run(ctx) {
    const node = ctx.node
    if (node.kind !== "agent") throw new Error("not an agent node")
    const instructions = ctx.frozenPath("prompt.md")
    if (!existsSync(instructions)) throw new Error("missing_prompt")
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
        instructions,
        modelFields: resolveAttemptModelFields(task, ctx.graph),
        prepare({ attemptRoot, inputDir }) {
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
              instructions,
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
    const text =
      readOptional(join(attemptRoot, "SUMMARY.md")) ??
      readOptional(join(attemptRoot, "stdout.log")) ??
      ""
    const result = settleProcessOutput(ctx, attemptRoot, text)
    const raw = readOptional(join(attemptRoot, "out", "answer.json"))
    if (raw !== undefined) {
      try {
        const answer: unknown = JSON.parse(raw)
        if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
          result.answer = answer as Record<string, unknown>
        }
      } catch {
        /* an unreadable answer is ignored until answers are declared */
      }
    }
    return result
  },
})
