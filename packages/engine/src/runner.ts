import { spawn, type ChildProcess } from "node:child_process"
import { closeSync, mkdirSync, openSync } from "node:fs"
import { join, resolve } from "node:path"
import { isAgentTask, type Task, type Workflow } from "@workspace/shared"
import {
  buildAgentShellCommand,
  copyTaskMemories,
  prepareAgentAttemptOut,
} from "./agents.ts"
import { writeCursorTrustMarker } from "./cursor-trust.ts"
import { attemptDir, taskDir } from "./paths.ts"
import { exitCodePath } from "./pid.ts"
import { buildSandboxSpawn } from "./sandbox.ts"

export type LaunchResult = {
  child: ChildProcess
  pid: number
  attemptRoot: string
  sandboxed: boolean
}

export type TaskEnvPaths = {
  workflowRoot: string
  runRoot: string
  runId: string
}

/** Absolute path to a task's instructions file, or undefined. */
export function instructionsAbsPath(
  task: Task,
  workflowRoot: string
): string | undefined {
  if (!("instructions" in task) || !task.instructions) return undefined
  return resolve(workflowRoot, task.instructions)
}

/** Build the env vars a task process receives (DES-002, DES-006). */
export function buildTaskEnv(
  task: Task,
  attempt: number,
  paths: TaskEnvPaths,
  graph: Workflow
): NodeJS.ProcessEnv {
  const { workflowRoot, runRoot, runId } = paths
  const attemptRoot = attemptDir(runRoot, task.id, attempt)
  const tmpDir = join(attemptRoot, "tmp")
  mkdirSync(tmpDir, { recursive: true })
  const instructions = instructionsAbsPath(task, workflowRoot)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: tmpDir,
    TMP: tmpDir,
    TEMP: tmpDir,
    RUN_ID: runId,
    WF_DIR: workflowRoot,
    WF_INPUT: join(workflowRoot, "input"),
    WF_OUTPUT: join(workflowRoot, "output"),
    TASK_IN: join(taskDir(runRoot, task.id), "input"),
    TASK_OUT: join(attemptRoot, "out"),
    PREV_ATTEMPT: attempt > 1 ? attemptDir(runRoot, task.id, attempt - 1) : "",
  }
  if (instructions) env.TASK_INSTRUCTIONS = instructions

  for (const upstream of graph.tasks) {
    env[`UPSTREAM_${upstream.id}`] = join(
      taskDir(runRoot, upstream.id),
      "latest",
      "out"
    )
  }

  return env
}

/**
 * Wrap the task command so it always writes exit.code under the attempt
 * dir. Resume reads that file when re-attaching by pid (DES-003).
 */
export function wrapCommandWithExitCode(run: string, codePath: string): string {
  const escaped = codePath.replaceAll("'", "'\\''")
  return [
    run,
    `__flow_code=$?`,
    `printf '%s' "$__flow_code" > '${escaped}'`,
    `exit "$__flow_code"`,
  ].join("\n")
}

function spawnWrapped(
  shellCommand: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  attemptRoot: string,
  codePath: string,
  workflowRoot: string,
  allowCursorHome = false
): LaunchResult {
  const stdoutFd = openSync(join(attemptRoot, "stdout.log"), "a")
  const stderrFd = openSync(join(attemptRoot, "stderr.log"), "a")

  try {
    const wrapped = wrapCommandWithExitCode(shellCommand, codePath)
    const sandboxedSpawn = buildSandboxSpawn(wrapped, workflowRoot, {
      allowCursorHome,
    })
    const child = spawn(sandboxedSpawn.command, sandboxedSpawn.args, {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    })

    if (child.pid === undefined) {
      throw new Error("failed to spawn task process")
    }

    return {
      child,
      pid: child.pid,
      attemptRoot,
      sandboxed: sandboxedSpawn.sandboxed,
    }
  } finally {
    closeSync(stdoutFd)
    closeSync(stderrFd)
  }
}

/**
 * Launch a command or agent task as a detached process in its own group.
 * Agents use cwd = attempt dir (DES-005); commands use the workflow root.
 * Writes are limited to the workflow dir when sandbox-exec applies (DES-006).
 */
export function launchTask(
  task: Task,
  attempt: number,
  paths: TaskEnvPaths,
  graph: Workflow
): LaunchResult {
  const attemptRoot = attemptDir(paths.runRoot, task.id, attempt)
  const codePath = exitCodePath(paths.runRoot, task.id, attempt)
  const env = buildTaskEnv(task, attempt, paths, graph)

  if (isAgentTask(task)) {
    const instructions = instructionsAbsPath(task, paths.workflowRoot)
    if (!instructions) {
      throw new Error(`agent task ${task.id} missing instructions`)
    }
    copyTaskMemories(
      task,
      paths.workflowRoot,
      join(taskDir(paths.runRoot, task.id), "input")
    )
    prepareAgentAttemptOut(attemptRoot, task.spawn === true)
    // Cursor may write a trust marker for --workspace (attempt). Do that
    // unsandboxed; inheritance from FLOWAPP_HOME alone is not enough
    // (BL-018 live check).
    if (task.cli === "cursor") {
      writeCursorTrustMarker(paths.workflowRoot)
      writeCursorTrustMarker(attemptRoot)
    }
    return spawnWrapped(
      buildAgentShellCommand(task, instructions, {
        workflowRoot: paths.workflowRoot,
        attemptRoot,
      }),
      attemptRoot,
      env,
      attemptRoot,
      codePath,
      paths.workflowRoot,
      task.cli === "cursor"
    )
  }

  return spawnWrapped(
    task.run,
    paths.workflowRoot,
    env,
    attemptRoot,
    codePath,
    paths.workflowRoot
  )
}

/** Alias used by older call sites and tests. */
export const launchCommand = launchTask

/** Wait for a child process to exit; resolves with the exit code. */
export function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (signal) {
        resolvePromise(1)
        return
      }
      resolvePromise(code ?? 1)
    })
  })
}
