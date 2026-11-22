import type { ChildProcess } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import {
  NODE_KINDS,
  upstreamEnvName,
  type NodeWorkflow,
} from "@workspace/shared"
import { loadAppConfig, effectiveLimit } from "../config.ts"
import { resolveFinishReason } from "../failure-reason.ts"
import { isPidAlive, killProcessGroup, waitForPid } from "../pid.ts"
import { spawnWrapped, waitForExit } from "../runner.ts"
import { workflowCacheEnv } from "../task-cache-env.ts"
import { remainingTimeoutMs, resolveAttemptTimeout } from "../timeout.ts"
import type { ExecContext, ExecResult, LaunchSpec } from "./define.ts"
import type { StepState, StepsState } from "./fold-steps.ts"
import { relOut } from "./step-paths.ts"

/** What the tick shares with attempt watchers (DES-034). */
export type ProcessHost = {
  /** `nodeId:pass:attempt` keys that have a watcher in this process. */
  watching: Set<string>
  /** Ask for another tick once an attempt has finished. */
  wake(): void
  /** Ask for another tick after `ms` (retry backoff). */
  later(ms: number): void
}

const now = () => new Date().toISOString()

export function attemptKey(nodeId: string, pass: number, attempt: number) {
  return `${nodeId}:${pass}:${attempt}`
}

export function attemptRootOf(
  stepDir: string,
  attempt: number
): string {
  return join(stepDir, `attempt-${attempt}`)
}

function readExit(attemptRoot: string): number | null {
  try {
    const raw = readFileSync(join(attemptRoot, "exit.code"), "utf8").trim()
    return /^-?\d+$/.test(raw) ? Number(raw) : null
  } catch {
    return null
  }
}

function readStderr(attemptRoot: string): string {
  try {
    return readFileSync(join(attemptRoot, "stderr.log"), "utf8")
  } catch {
    return ""
  }
}

function cliOf(graph: NodeWorkflow, nodeId: string): "claude" | "cursor" | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId)
  return node?.kind === "agent" ? node.cli : undefined
}

function isCliKind(graph: NodeWorkflow, nodeId: string): boolean {
  const kind = graph.nodes.find((n) => n.id === nodeId)?.kind
  return NODE_KINDS.find((k) => k.kind === kind)?.process === "cli"
}

/** Open attempts across the run, and how many are CLI steps. */
function openCounts(graph: NodeWorkflow, steps: StepsState) {
  let all = 0
  let agents = 0
  for (const [nodeId, list] of Object.entries(steps.steps)) {
    for (const s of list) {
      if (!s.current?.open) continue
      all += 1
      if (isCliKind(graph, nodeId)) agents += 1
    }
  }
  return { all, agents }
}

/** `input/text.md` and `input/files/<fromNodeId>/` links (DES-034). */
function writeInputs(ctx: ExecContext, inputDir: string): void {
  mkdirSync(inputDir, { recursive: true })
  const parts: string[] = []
  for (const input of ctx.inputs) {
    const name =
      ctx.graph.nodes.find((n) => n.id === input.nodeId)?.name ?? input.nodeId
    const textPath = join(input.dir, "text.md")
    if (existsSync(textPath)) {
      parts.push(`## ${name}\n\n${readFileSync(textPath, "utf8").trimEnd()}\n`)
    }
    const files = join(input.dir, "files")
    if (existsSync(files)) {
      mkdirSync(join(inputDir, "files"), { recursive: true })
      symlinkSync(files, join(inputDir, "files", input.nodeId))
    }
  }
  writeFileSync(join(inputDir, "text.md"), parts.join("\n"))
}

function buildEnv(
  ctx: ExecContext,
  spec: LaunchSpec,
  attemptRoot: string,
  attempt: number,
  runId: string
): NodeJS.ProcessEnv {
  const tmp = join(attemptRoot, "tmp")
  mkdirSync(tmp, { recursive: true })
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...workflowCacheEnv(ctx.workflowRoot),
    TMPDIR: tmp,
    TMP: tmp,
    TEMP: tmp,
    RUN_ID: runId,
    WF_DIR: ctx.workflowRoot,
    WF_INPUT: join(ctx.workflowRoot, "input"),
    WF_OUTPUT: join(ctx.workflowRoot, "output"),
    RUN_INPUT: join(ctx.runRoot, "input"),
    RESOURCES_DIR: join(ctx.runRoot, "resources"),
    NODE_ID: ctx.node.id,
    NODE_IN: join(attemptRoot, "input"),
    NODE_OUT: join(attemptRoot, "out"),
    PREV_ATTEMPT: attempt > 1 ? attemptRootOf(ctx.stepDir, attempt - 1) : "",
  }
  if (spec.instructions) env.NODE_INSTRUCTIONS = spec.instructions
  for (const input of ctx.inputs) {
    env[upstreamEnvName(input.nodeId)] = join(input.dir, "files")
  }
  return env
}

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

type WatchArgs = {
  run: Run
  host: ProcessHost
  graph: NodeWorkflow
  nodeId: string
  pass: number
  attempt: number
  attemptRoot: string
  pid: number
  timeoutSeconds: number
  startedAt: string
}

/** Settles an attempt once: exit, timeout, or a pid that left no code. */
function watch(
  a: WatchArgs,
  wait: (done: (code: number | null) => void) => void
): void {
  const key = attemptKey(a.nodeId, a.pass, a.attempt)
  if (a.host.watching.has(key)) return
  a.host.watching.add(key)
  let timedOut = false
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const settle = (code: number | null) => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    if (code === null) {
      a.run.log.append({
        type: "attempt_interrupted",
        runId: a.run.runId,
        at: now(),
        taskId: a.nodeId,
        nodeId: a.nodeId,
        pass: a.pass,
        attempt: a.attempt,
      } as never)
    } else {
      const reason = resolveFinishReason({
        stderr: readStderr(a.attemptRoot),
        cli: cliOf(a.graph, a.nodeId),
        timedOut,
      })
      appendFinished(a.run, a.nodeId, a.pass, a.attempt, code, reason)
    }
    a.host.wake()
  }
  const remaining = remainingTimeoutMs(a.startedAt, a.timeoutSeconds)
  const fire = () => {
    timedOut = true
    killProcessGroup(a.pid)
    settle(readExit(a.attemptRoot) ?? 1)
  }
  if (remaining <= 0) fire()
  else timer = setTimeout(fire, remaining)
  wait((code) => {
    if (code === null && timedOut) settle(1)
    else settle(code)
  })
}

/**
 * Starts one attempt of a process step on the existing spawn path
 * (`spawnWrapped`, sandbox, exit.code wrapper). Returns false when a
 * limit holds the step back; the step stays open and a later tick tries
 * again (DES-034, Limits).
 */
export function launchAttempt(
  run: Run,
  ctx: ExecContext,
  spec: LaunchSpec,
  steps: StepsState
): boolean {
  const host = run.process
  if (!host) throw new Error("process steps need a process host")
  const { graph, node, pass } = ctx
  const caps = {
    concurrency: effectiveLimit(
      loadAppConfig(run.home).limits,
      graph.limits,
      "concurrency"
    ),
    agents: effectiveLimit(
      loadAppConfig(run.home).limits,
      graph.limits,
      "agents"
    ),
  }
  const open = openCounts(graph, steps)
  if (caps.concurrency !== undefined && open.all >= caps.concurrency) {
    return false
  }
  if (spec.agent && caps.agents !== undefined && open.agents >= caps.agents) {
    return false
  }

  const step: StepState | undefined = steps.steps[node.id]?.find(
    (s) => s.pass === pass
  )
  const attempt = (step?.attempts ?? 0) + 1
  const attemptRoot = attemptRootOf(ctx.stepDir, attempt)
  const inputDir = join(attemptRoot, "input")
  const started = {
    type: "attempt_started",
    runId: run.runId,
    taskId: node.id,
    nodeId: node.id,
    pass,
    attempt,
  }

  let cmd: ReturnType<LaunchSpec["command"]>
  try {
    rmSync(attemptRoot, { recursive: true, force: true })
    mkdirSync(join(attemptRoot, "out"), { recursive: true })
    writeInputs(ctx, inputDir)
    spec.prepare?.({ attemptRoot, inputDir })
    cmd = spec.command({ attemptRoot })
  } catch (err) {
    run.log.append({ ...started, at: now() } as never)
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

  const startedAt = now()
  run.log.append({ ...started, at: startedAt } as never)
  run.crashAt?.("after_attempt_started", node.id)

  const timeout = resolveAttemptTimeout(
    { timeout: (node as { timeout?: number }).timeout },
    graph
  )
  let child: ChildProcess
  let sandboxed = false
  try {
    const launched = spawnWrapped(
      cmd.shell,
      cmd.cwd === "attempt" ? attemptRoot : ctx.workflowRoot,
      buildEnv(ctx, spec, attemptRoot, attempt, run.runId),
      attemptRoot,
      join(attemptRoot, "exit.code"),
      ctx.workflowRoot,
      cmd.allowCursorHome === true
    )
    child = launched.child
    sandboxed = launched.sandboxed
  } catch (err) {
    appendFinished(
      run,
      node.id,
      pass,
      attempt,
      1,
      err instanceof Error ? err.message : "spawn_failed"
    )
    return true
  }

  run.log.append({
    type: "attempt_launched",
    runId: run.runId,
    at: now(),
    taskId: node.id,
    nodeId: node.id,
    pass,
    attempt,
    pid: child.pid!,
    sandboxed,
    timeout,
    ...(spec.modelFields ?? {}),
  } as never)
  run.crashAt?.("after_attempt_launched", node.id)
  watch(
    {
      run,
      host,
      graph,
      nodeId: node.id,
      pass,
      attempt,
      attemptRoot,
      pid: child.pid!,
      timeoutSeconds: timeout,
      startedAt,
    },
    (done) => {
      void waitForExit(child)
        .then((code) => done(code))
        .catch(() => done(1))
    }
  )
  return true
}

/**
 * Crash recovery for open attempts (DES-034): re-attach to a live pid
 * with the remaining timeout, else read `exit.code`, else record
 * `attempt_interrupted`. The retry policy then applies in the tick.
 */
export function reattachAttempts(
  run: Run,
  graph: NodeWorkflow,
  steps: StepsState,
  runRootOf: (nodeId: string, pass: number) => string
): void {
  const host = run.process
  if (!host) return
  for (const [nodeId, list] of Object.entries(steps.steps)) {
    for (const s of list) {
      const c = s.current
      if (!c?.open) continue
      if (host.watching.has(attemptKey(nodeId, s.pass, c.attempt))) continue
      const attemptRoot = attemptRootOf(runRootOf(nodeId, s.pass), c.attempt)
      const timeout = c.timeout
      const overdue =
        timeout !== undefined && remainingTimeoutMs(c.startedAt, timeout) <= 0
      if (c.pid !== undefined && isPidAlive(c.pid)) {
        watch(
          {
            run,
            host,
            graph,
            nodeId,
            pass: s.pass,
            attempt: c.attempt,
            attemptRoot,
            pid: c.pid,
            timeoutSeconds: timeout ?? Number.MAX_SAFE_INTEGER / 1000,
            startedAt: c.startedAt,
          },
          (done) => {
            void waitForPid(c.pid!).then(() => done(readExit(attemptRoot)))
          }
        )
        continue
      }
      const code = readExit(attemptRoot)
      if (code !== null) {
        appendFinished(
          run,
          nodeId,
          s.pass,
          c.attempt,
          code,
          resolveFinishReason({
            stderr: readStderr(attemptRoot),
            cli: cliOf(graph, nodeId),
            timedOut: overdue,
          })
        )
      } else if (overdue) {
        appendFinished(run, nodeId, s.pass, c.attempt, 1, "timeout")
      } else {
        run.log.append({
          type: "attempt_interrupted",
          runId: run.runId,
          at: now(),
          taskId: nodeId,
          nodeId,
          pass: s.pass,
          attempt: c.attempt,
        } as never)
      }
    }
  }
}

function listDir(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

/**
 * Copies a finished attempt into the step folder: `text.md` and
 * `files/` (from `out/`), the same shape as the no-process kinds, so
 * the next step reads every source alike.
 */
export function settleProcessOutput(
  ctx: ExecContext,
  attemptRoot: string,
  text: string
): ExecResult {
  rmSync(join(ctx.stepDir, "text.md"), { force: true })
  rmSync(join(ctx.stepDir, "files"), { recursive: true, force: true })
  writeFileSync(join(ctx.stepDir, "text.md"), text)
  const base = relOut("nodes", ctx.node.id, `pass-${ctx.pass}`)
  const outputs = [relOut(base, "text.md")]
  for (const name of listDir(join(attemptRoot, "out"))) {
    cpSync(join(attemptRoot, "out", name), join(ctx.stepDir, "files", name), {
      recursive: true,
    })
    outputs.push(relOut(base, "files", name))
  }
  return { outputs }
}

export function readOptional(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined
}
