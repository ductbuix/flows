import type {
  ProcessRunner,
  ProcessSpawnSpec,
  RunningProcess,
} from "../ports/process-runner.ts"

export type FakeProcessResult = {
  stdout?: Uint8Array | string
  stderr?: Uint8Array | string
  exitCode?: number
}

export type FakeProcessHandler = (
  spec: ProcessSpawnSpec
) => FakeProcessResult | Promise<FakeProcessResult>

function toBytes(data: Uint8Array | string | undefined): Uint8Array {
  if (data === undefined) return new Uint8Array()
  if (typeof data === "string") return new TextEncoder().encode(data)
  return data
}

function enqueueAndClose(
  controller: ReadableStreamDefaultController<Uint8Array>,
  data: Uint8Array
): void {
  if (data.byteLength > 0) controller.enqueue(data)
  controller.close()
}

let nextPid = 10_000

/** In-memory ProcessRunner; register handlers with `on(command, handler)`. */
export class FakeProcessRunner implements ProcessRunner {
  private readonly handlers = new Map<string, FakeProcessHandler>()

  on(command: string, handler: FakeProcessHandler): this {
    this.handlers.set(command, handler)
    return this
  }

  spawn(spec: ProcessSpawnSpec, signal: AbortSignal): RunningProcess {
    const pid = ++nextPid
    const handler: FakeProcessHandler =
      this.handlers.get(spec.command) ?? (() => ({ exitCode: 0 }))
    const sandboxed = spec.sandbox !== undefined

    let settle!: (code: number) => void
    const exit = new Promise<number>((resolve) => {
      settle = resolve
    })

    let stdoutCtrl!: ReadableStreamDefaultController<Uint8Array>
    let stderrCtrl!: ReadableStreamDefaultController<Uint8Array>
    const stdout = new ReadableStream<Uint8Array>({
      start(c) {
        stdoutCtrl = c
      },
    })
    const stderr = new ReadableStream<Uint8Array>({
      start(c) {
        stderrCtrl = c
      },
    })

    const onAbort = () => {
      try {
        stdoutCtrl.close()
      } catch {
        /* already closed */
      }
      try {
        stderrCtrl.close()
      } catch {
        /* already closed */
      }
      settle(1)
    }
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener("abort", onAbort, { once: true })
      void Promise.resolve()
        .then(() => handler(spec))
        .then((result) => {
          if (signal.aborted) return
          enqueueAndClose(stdoutCtrl, toBytes(result.stdout))
          enqueueAndClose(stderrCtrl, toBytes(result.stderr))
          settle(result.exitCode ?? 0)
        })
        .catch(() => onAbort())
    }

    return {
      pid,
      stdin: new WritableStream(),
      stdout,
      stderr,
      exit,
      sandboxed,
    }
  }
}

export function createFakeProcessRunner(): FakeProcessRunner {
  return new FakeProcessRunner()
}
