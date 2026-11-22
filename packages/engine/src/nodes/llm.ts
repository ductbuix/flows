import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { AgentTask } from "@workspace/shared"
import { resolveModelEffort } from "@workspace/shared"
import { resolveAttemptModelFields } from "../attempt-model.ts"
import { getCliAdapter } from "../cli-adapters.ts"
import { writeCursorTrustMarker } from "../cursor-trust.ts"
import { defineExecutor } from "./define.ts"
import { readOptional, settleProcessOutput } from "./process.ts"

/** The prompt file of one call: system, prompt, then the input (DES-032). */
export function llmPromptText(parts: {
  system?: string
  prompt: string
  input: string
}): string {
  const out: string[] = []
  const system = parts.system?.trim()
  if (system) out.push(system)
  out.push(parts.prompt.trim())
  const input = parts.input.trim()
  if (input) out.push(`## Input\n\n${input}`)
  return `${out.join("\n\n")}\n`
}

/**
 * LLM step (DES-032): one CLI call in print mode with tools off. The
 * prompt goes in on stdin from `input/prompt.txt`; stdout is `text`.
 * The sandbox writes only the attempt folder.
 */
export const llmExecutor = defineExecutor({
  kind: "llm",
  run(ctx) {
    const node = ctx.node
    if (node.kind !== "llm") throw new Error("not an llm node")
    const frozen = ctx.frozenPath("prompt.md")
    if (!existsSync(frozen)) throw new Error("missing_prompt")
    const task: AgentTask = {
      id: node.id,
      needs: [],
      kind: "agent",
      cli: node.cli,
      ...(node.model !== undefined ? { model: node.model } : {}),
      ...(node.effort !== undefined ? { effort: node.effort } : {}),
    }
    return {
      launch: {
        agent: true,
        cli: node.cli,
        modelFields: resolveAttemptModelFields(task, ctx.graph),
        prepare({ attemptRoot, inputDir }) {
          const text = llmPromptText({
            system: ctx.frozenFile("system.md"),
            prompt: readFileSync(frozen, "utf8"),
            input: readOptional(join(inputDir, "text.md")) ?? "",
          })
          writeFileSync(join(inputDir, "prompt.txt"), text)
          if (node.cli === "cursor") {
            writeCursorTrustMarker(attemptRoot)
          }
        },
        command({ attemptRoot }) {
          const resolved = resolveModelEffort({
            judge: { model: node.model, effort: node.effort },
            judgeCli: node.cli,
            workflowAgent: ctx.graph.agent,
          })
          return {
            shell: getCliAdapter(node.cli).buildLlmCommand(
              join(attemptRoot, "input", "prompt.txt"),
              resolved
            ),
            cwd: "attempt",
            allowCursorHome: node.cli === "cursor",
            writeAttemptOnly: true,
          }
        },
      },
    }
  },
  finish(ctx, attemptRoot) {
    const text = (readOptional(join(attemptRoot, "stdout.log")) ?? "").trim()
    return settleProcessOutput(ctx, attemptRoot, text)
  },
})
