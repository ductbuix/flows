import type { Capability, ConnectorFile } from "@workspace/contracts"
import { engineError } from "../kernel/engine-error.ts"
import type { ProcessRunner } from "../ports/process-runner.ts"
import type {
  ConnectorCallResult,
  ConnectorCheckResult,
  ConnectorTransportHandler,
} from "./transport.ts"

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(out)
}

async function runBinary(
  runner: ProcessRunner,
  command: string,
  args: readonly string[],
  signal: AbortSignal
): Promise<ConnectorCallResult> {
  const proc = runner.spawn({ command, args: [...args] }, signal)
  void proc.stdin.close()
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exit,
  ])
  return { stdout, stderr, exitCode }
}

/**
 * CLI transport: `how` is the binary; capability `cmd` is the argv prefix
 * from the connector file; call args are appended (BL-161).
 */
export function createCliTransport(
  runner: ProcessRunner
): ConnectorTransportHandler {
  return {
    kind: "cli",
    async call(connector, capability, args, signal) {
      assertCliConnector(connector)
      const cmd = capability.cmd
      if (!cmd || cmd.length === 0) {
        throw engineError(
          "invalid_params",
          `Capability "${capability.name}" has no cmd mapping`
        )
      }
      return runBinary(runner, connector.how, [...cmd, ...args], signal)
    },
    async check(connector, signal): Promise<ConnectorCheckResult> {
      assertCliConnector(connector)
      try {
        const result = await runBinary(
          runner,
          connector.how,
          ["--version"],
          signal
        )
        return {
          ok: true,
          detail: result.stdout.trim() || result.stderr.trim() || undefined,
        }
      } catch (err) {
        return {
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

function assertCliConnector(connector: ConnectorFile): void {
  if (connector.transport !== "cli") {
    throw engineError(
      "invalid_params",
      `CLI transport cannot run connector with transport "${connector.transport}"`
    )
  }
}

/** Resolve the argv for a capability (cmd from file + call args). */
export function cliArgv(
  capability: Capability,
  args: readonly string[]
): string[] | null {
  if (!capability.cmd || capability.cmd.length === 0) return null
  return [...capability.cmd, ...args]
}
