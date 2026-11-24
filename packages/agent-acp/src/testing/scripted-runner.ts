import { PassThrough, Readable, Writable } from "node:stream"
import type {
  ProcessRunner,
  ProcessSpawnSpec,
  RunningProcess,
} from "@workspace/core"
import { runFakeAgent, type FakeAgentScript } from "./fake-agent.ts"

export type ScriptedSpawn = {
  spec: ProcessSpawnSpec
  script: FakeAgentScript
}

export type ScriptedProcessRunner = ProcessRunner & {
  /** Spawns recorded in order (for asserting argv / cwd). */
  readonly spawns: readonly ScriptedSpawn[]
}

/**
 * ProcessRunner that drives `runFakeAgent` over stdio for each spawn.
 * `resolveScript` picks the JSON-RPC script from the spawn spec.
 */
export function createScriptedProcessRunner(
  resolveScript: (spec: ProcessSpawnSpec) => FakeAgentScript
): ScriptedProcessRunner {
  const spawns: ScriptedSpawn[] = []
  let nextPid = 20_000

  return {
    get spawns() {
      return spawns
    },
    spawn(spec: ProcessSpawnSpec, signal: AbortSignal): RunningProcess {
      const script = resolveScript(spec)
      spawns.push({ spec, script })

      const toAgent = new PassThrough()
      const toClient = new PassThrough()
      const agent = runFakeAgent(script, toAgent, toClient)

      let settle!: (code: number) => void
      const exit = new Promise<number>((resolve) => {
        settle = resolve
      })

      const onAbort = () => {
        agent.close()
        toAgent.destroy()
        toClient.destroy()
        settle(1)
      }
      if (signal.aborted) {
        onAbort()
      } else {
        signal.addEventListener("abort", onAbort, { once: true })
        void agent.done.then(
          () => settle(0),
          () => settle(1)
        )
      }

      return {
        pid: ++nextPid,
        stdin: Writable.toWeb(toAgent),
        stdout: Readable.toWeb(toClient) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(new PassThrough()) as ReadableStream<Uint8Array>,
        exit,
        sandboxed: spec.sandbox !== undefined,
      }
    },
  }
}
