import { spawn } from "node:child_process"
import { Readable, Writable } from "node:stream"
import type {
  ProcessRunner,
  ProcessSpawnSpec,
  RunningProcess,
} from "@workspace/core/ports"
import { killProcessGroup } from "./pid.ts"
import { buildSandboxArgv } from "./sandbox.ts"

function waitChildExit(
  child: ReturnType<typeof spawn>,
  signal: AbortSignal
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      if (child.pid !== undefined) killProcessGroup(child.pid)
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort, { once: true })

    child.once("error", (err) => {
      signal.removeEventListener("abort", onAbort)
      reject(err)
    })
    child.once("exit", (code, sig) => {
      signal.removeEventListener("abort", onAbort)
      if (sig) {
        resolve(1)
        return
      }
      resolve(code ?? 1)
    })
  })
}

export function createNodeProcessRunner(): ProcessRunner {
  return {
    spawn(spec: ProcessSpawnSpec, signal: AbortSignal): RunningProcess {
      let command = spec.command
      let args = [...(spec.args ?? [])]
      let sandboxed = false
      if (spec.sandbox) {
        const wrapped = buildSandboxArgv(
          command,
          args,
          spec.sandbox.workflowRoot,
          {
            allowCursorHome: spec.sandbox.allowCursorHome,
            ...(spec.sandbox.writeRoot !== undefined
              ? { writeRoot: spec.sandbox.writeRoot }
              : {}),
          }
        )
        command = wrapped.command
        args = wrapped.args
        sandboxed = wrapped.sandboxed
      }

      const child = spawn(command, args, {
        cwd: spec.cwd,
        env: spec.env as NodeJS.ProcessEnv | undefined,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
      })

      // Attach before checking pid so ENOENT does not crash the process.
      const exit = waitChildExit(child, signal).catch(() => 1)

      if (child.pid === undefined) {
        throw new Error(`failed to spawn process: ${command}`)
      }
      if (!child.stdin || !child.stdout || !child.stderr) {
        throw new Error("spawn did not provide stdio pipes")
      }

      return {
        pid: child.pid,
        stdin: Writable.toWeb(child.stdin),
        stdout: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>,
        exit,
        sandboxed,
      }
    },
  }
}
