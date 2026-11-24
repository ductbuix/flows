import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createAcpRuntime } from "@workspace/agent-acp"
import { llmContentBlocks, llmProfileId, llmPromptText } from "@workspace/core"
import { effectiveLimit, loadAppConfig } from "../config.ts"
import { getProcessRunner } from "../process-runner.ts"
import { resolveAttemptTimeout } from "../timeout.ts"
import { filledFile } from "./answers.ts"
import type { AcpLaunchSpec, ExecContext } from "./define.ts"
import type { StepsState } from "./fold-steps.ts"
import { inputsAsStepInputs, writeAttemptInputs } from "./llm-acp-inputs.ts"
import { attemptKey, attemptRootOf, type ProcessHost } from "./process.ts"

const now = () => new Date().toISOString()

type Run = {
  log: { append(event: never): unknown }
  runId: string
  home: string
  process?: ProcessHost
  crashAt?: (
    point:
      | "after_step_started"
      | "after_act"
      | "after_attempt_started"
      | "after_attempt_launched",
    nodeId: string
  ) => void
}

/** True when config.yaml sets `agents.runtime: acp`. */
export function agentsRuntimeIsAcp(home: string): boolean {
  return loadAppConfig(home).agents?.runtime === "acp"
}

export function homeOfWorkflowRoot(workflowRoot: string): string {
  return dirname(dirname(workflowRoot))
}

function appendFinished(
  run: Run,
  nodeId: string,
  pass: number,
  attempt: number,
  exitCode: number,
  reason?: string
): void {
  run.log.append({
    type: "attempt_finished",
    runId: run.runId,
    at: now(),
    taskId: nodeId,
    nodeId,
    pass,
    attempt,
    exitCode,
    ...(reason !== undefined ? { reason } : {}),
  } as never)
}

/**
 * ACP llm attempt: session prompt with resource blocks, stdout.log for
 * finish(), then wake the tick (BL-142).
 */
export function launchAcpAttempt(
  run: Run,
  ctx: ExecContext,
  spec: AcpLaunchSpec,
  steps: StepsState
): boolean {
  const host = run.process
  if (!host) throw new Error("ACP steps need a process host")
  const { graph, node, pass } = ctx
  const cfg = loadAppConfig(run.home)
  const caps = {
    concurrency: effectiveLimit(cfg.limits, graph.limits, "concurrency"),
    agents: effectiveLimit(cfg.limits, graph.limits, "agents"),
  }
  let openAll = 0
  let openAgents = 0
  for (const list of Object.values(steps.steps)) {
    for (const s of list) {
      if (!s.current?.open) continue
      openAll += 1
      openAgents += 1
    }
  }
  if (caps.concurrency !== undefined && openAll >= caps.concurrency)
    return false
  if (spec.agent && caps.agents !== undefined && openAgents >= caps.agents) {
    return false
  }

  const step = steps.steps[node.id]?.find((s) => s.pass === pass)
  const attempt = (step?.attempts ?? 0) + 1
  const attemptRoot = attemptRootOf(ctx.stepDir, attempt)
  const startedAt = now()

  try {
    rmSync(attemptRoot, { recursive: true, force: true })
    mkdirSync(join(attemptRoot, "out"), { recursive: true })
    writeAttemptInputs(ctx, join(attemptRoot, "input"))
  } catch (err) {
    run.log.append({
      type: "attempt_started",
      runId: run.runId,
      at: startedAt,
      taskId: node.id,
      nodeId: node.id,
      pass,
      attempt,
    } as never)
    appendFinished(
      run,
      node.id,
      pass,
      attempt,
      1,
      err instanceof Error ? err.message : "prepare_failed"
    )
    return true
  }

  run.log.append({
    type: "attempt_started",
    runId: run.runId,
    at: startedAt,
    taskId: node.id,
    nodeId: node.id,
    pass,
    attempt,
  } as never)
  run.crashAt?.("after_attempt_started", node.id)
  run.log.append({
    type: "attempt_launched",
    runId: run.runId,
    at: now(),
    taskId: node.id,
    nodeId: node.id,
    pass,
    attempt,
    pid: 1,
    sandboxed: false,
    ...(spec.modelFields ?? {}),
  } as never)
  run.crashAt?.("after_attempt_launched", node.id)

  const key = attemptKey(node.id, pass, attempt)
  host.watching.add(key)
  const timeoutSec = resolveAttemptTimeout(
    { timeout: (node as { timeout?: number }).timeout },
    graph
  )
  const ac = new AbortController()
  const timer =
    timeoutSec !== undefined
      ? setTimeout(() => ac.abort(), timeoutSec * 1000)
      : undefined

  const blocks = llmContentBlocks(
    llmPromptText({
      system: filledFile(ctx, "system.md") || undefined,
      prompt: filledFile(ctx, "prompt.md") ?? "",
    }),
    inputsAsStepInputs(ctx)
  )
  const profileId = spec.profileId || llmProfileId(spec.cli ?? "cursor")

  void (async () => {
    try {
      const runtime = createAcpRuntime({
        processRunner: getProcessRunner(),
      })
      const session = await runtime.open(
        {
          profileId,
          cwd: attemptRoot,
          mode: spec.mode,
          ...(spec.model !== undefined ? { model: spec.model } : {}),
          ...(spec.effort !== undefined ? { effort: spec.effort } : {}),
        },
        ac.signal
      )
      let text = ""
      try {
        if (session.setMode) await session.setMode(spec.mode)
        for await (const event of session.prompt(blocks, ac.signal)) {
          if (event.kind === "message_chunk") text += event.text
        }
      } finally {
        await session.close()
      }
      writeFileSync(join(attemptRoot, "stdout.log"), text)
      writeFileSync(join(attemptRoot, "exit.code"), "0\n")
      appendFinished(run, node.id, pass, attempt, 0)
    } catch (err) {
      writeFileSync(
        join(attemptRoot, "stderr.log"),
        err instanceof Error ? err.message : String(err)
      )
      writeFileSync(join(attemptRoot, "exit.code"), "1\n")
      appendFinished(
        run,
        node.id,
        pass,
        attempt,
        1,
        err instanceof Error ? err.message : "acp_failed"
      )
    } finally {
      if (timer) clearTimeout(timer)
      host.watching.delete(key)
      host.wake()
    }
  })()

  return true
}
