import { createWriteStream } from "node:fs"
import { join } from "node:path"
import { Writable } from "node:stream"
import type { ProcessRunner } from "@workspace/core/ports"
import { createNodeProcessRunner } from "./process-runner.ts"

export type LaunchResult = {
  pid: number
  attemptRoot: string
  sandboxed: boolean
  exit: Promise<number>
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

function pipeToAppend(
  stream: ReadableStream<Uint8Array>,
  path: string
): Promise<void> {
  const file = createWriteStream(path, { flags: "a" })
  return stream.pipeTo(Writable.toWeb(file)).catch(() => {
    /* process ended; ignore broken pipe */
  })
}

/**
 * Spawn a sandboxed shell task through ProcessRunner, appending stdout
 * and stderr under the attempt dir (DES-006, DES-041).
 */
export function spawnWrapped(
  shellCommand: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  attemptRoot: string,
  codePath: string,
  workflowRoot: string,
  allowCursorHome = false,
  writeRoot?: string,
  runner: ProcessRunner = createNodeProcessRunner()
): LaunchResult {
  const wrapped = wrapCommandWithExitCode(shellCommand, codePath)
  const proc = runner.spawn(
    {
      command: "/bin/sh",
      args: ["-c", wrapped],
      cwd,
      env: env as Record<string, string | undefined>,
      sandbox: {
        workflowRoot,
        allowCursorHome,
        ...(writeRoot !== undefined ? { writeRoot } : {}),
      },
    },
    new AbortController().signal
  )

  void pipeToAppend(proc.stdout, join(attemptRoot, "stdout.log"))
  void pipeToAppend(proc.stderr, join(attemptRoot, "stderr.log"))
  void proc.stdin.close()

  return {
    pid: proc.pid,
    attemptRoot,
    sandboxed: proc.sandboxed,
    exit: proc.exit,
  }
}
