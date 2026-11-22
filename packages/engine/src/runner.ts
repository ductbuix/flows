import { spawn, type ChildProcess } from "node:child_process"
import { closeSync, openSync } from "node:fs"
import { join } from "node:path"
import { buildSandboxSpawn } from "./sandbox.ts"

export type LaunchResult = {
  child: ChildProcess
  pid: number
  attemptRoot: string
  sandboxed: boolean
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

export function spawnWrapped(
  shellCommand: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  attemptRoot: string,
  codePath: string,
  workflowRoot: string,
  allowCursorHome = false,
  writeRoot?: string
): LaunchResult {
  const stdoutFd = openSync(join(attemptRoot, "stdout.log"), "a")
  const stderrFd = openSync(join(attemptRoot, "stderr.log"), "a")

  try {
    const wrapped = wrapCommandWithExitCode(shellCommand, codePath)
    const sandboxedSpawn = buildSandboxSpawn(wrapped, workflowRoot, {
      allowCursorHome,
      ...(writeRoot !== undefined ? { writeRoot } : {}),
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
