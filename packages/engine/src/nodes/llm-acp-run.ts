import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { createAcpRuntime } from "@workspace/agent-acp"
import {
  llmContentBlocks,
  llmProfileId,
  llmPromptText,
  type AcpInboxGates,
  type ContentBlock,
} from "@workspace/core"
import { getProcessRunner } from "../process-runner.ts"
import { filledFile } from "./answers.ts"
import type { AcpLaunchSpec, ExecContext } from "./define.ts"
import { acpSessionHandlers } from "./llm-acp-handlers.ts"
import { inputsAsStepInputs } from "./llm-acp-inputs.ts"

type RunLog = { append(event: never): unknown }

/** Drive one ACP session to stdout.log / exit.code (BL-142 / BL-192). */
export async function runAcpSession(input: {
  run: { runId: string; log: RunLog; acpAsks?: AcpInboxGates }
  ctx: ExecContext
  spec: AcpLaunchSpec
  attemptRoot: string
  pass: number
  attempt: number
  signal: AbortSignal
  appendFinished: (exitCode: number, reason?: string) => void
}): Promise<void> {
  const { run, ctx, spec, attemptRoot, pass, signal, appendFinished } = input
  const nodeId = ctx.node.id
  try {
    const runtime = createAcpRuntime({
      processRunner: getProcessRunner(),
    })
    const handlers = run.acpAsks
      ? acpSessionHandlers({
          runId: run.runId,
          nodeId,
          pass,
          attemptRoot,
          gates: run.acpAsks,
          ...(spec.planReview !== undefined
            ? { planReview: spec.planReview }
            : {}),
        })
      : undefined
    const session = await runtime.open(
      {
        profileId: spec.profileId || llmProfileId(spec.cli ?? "cursor"),
        cwd: attemptRoot,
        mode: spec.mode,
        ...(spec.model !== undefined ? { model: spec.model } : {}),
        ...(spec.effort !== undefined ? { effort: spec.effort } : {}),
        ...(handlers ?? {}),
      },
      signal
    )
    const blocks: ContentBlock[] = llmContentBlocks(
      llmPromptText({
        system: filledFile(ctx, "system.md") || undefined,
        prompt: filledFile(ctx, "prompt.md") ?? "",
      }),
      inputsAsStepInputs(ctx)
    )
    let text = ""
    try {
      if (session.setMode) await session.setMode(spec.mode)
      for await (const event of session.prompt(blocks, signal)) {
        if (event.kind === "message_chunk") text += event.text
      }
    } finally {
      await session.close()
    }
    writeFileSync(join(attemptRoot, "stdout.log"), text)
    writeFileSync(join(attemptRoot, "exit.code"), "0\n")
    appendFinished(0)
  } catch (err) {
    writeFileSync(
      join(attemptRoot, "stderr.log"),
      err instanceof Error ? err.message : String(err)
    )
    writeFileSync(join(attemptRoot, "exit.code"), "1\n")
    appendFinished(1, err instanceof Error ? err.message : "acp_failed")
  }
}
