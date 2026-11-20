import { spawn, type ChildProcess } from "node:child_process"
import { closeSync, openSync } from "node:fs"
import { join } from "node:path"
import type { CommandTask, Workflow } from "@workspace/shared"
import { attemptDir, taskDir } from "./paths.ts"
import { exitCodePath } from "./pid.ts"

export type LaunchResult = {
  child: ChildProcess
  pid: number
  attemptRoot: string
}

export type TaskEnvPaths = {
  workflowRoot: string
  runRoot: string
  runId: string
}

/** Build the env vars a task process receives (DES-002). */
export function buildTaskEnv(
  task: CommandTask,
  attempt: number,
  paths: TaskEnvPaths,
  graph: Workflow
): NodeJS.ProcessEnv {
  const { workflowRoot, runRoot, runId } = paths
  const attemptRoot = attemptDir(runRoot, task.id, attempt)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RUN_ID: runId,
    WF_DIR: workflowRoot,
    WF_INPUT: join(workflowRoot, "input"),
    WF_OUTPUT: join(workflowRoot, "output"),
    TASK_IN: join(taskDir(runRoot, task.id), "input"),
    TASK_OUT: join(attemptRoot, "out"),
    PREV_ATTEMPT: attempt > 1 ? attemptDir(runRoot, task.id, attempt - 1) : "",
  }

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

/**
 * Launch a command task as a detached process in its own group.
 * Caller must keep the ChildProcess to observe exit (append-then-act).
 */
export function launchCommand(
  task: CommandTask,
  attempt: number,
  paths: TaskEnvPaths,
  graph: Workflow
): LaunchResult {
  const attemptRoot = attemptDir(paths.runRoot, task.id, attempt)
  const codePath = exitCodePath(paths.runRoot, task.id, attempt)
  const stdoutFd = openSync(join(attemptRoot, "stdout.log"), "a")
  const stderrFd = openSync(join(attemptRoot, "stderr.log"), "a")

  try {
    const child = spawn(
      "/bin/sh",
      ["-c", wrapCommandWithExitCode(task.run, codePath)],
      {
        cwd: paths.workflowRoot,
        env: buildTaskEnv(task, attempt, paths, graph),
        detached: true,
        stdio: ["ignore", stdoutFd, stderrFd],
      }
    )

    if (child.pid === undefined) {
      throw new Error(`failed to spawn task ${task.id}`)
    }

    return { child, pid: child.pid, attemptRoot }
  } finally {
    closeSync(stdoutFd)
    closeSync(stderrFd)
  }
}

/** Wait for a child process to exit; resolves with the exit code. */
export function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (signal) {
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
}
