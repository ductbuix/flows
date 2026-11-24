import type { ProcessRunner } from "@workspace/core"

/** Read a process stdout to end and wait for exit. */
export async function readStdout(
  proc: ReturnType<ProcessRunner["spawn"]>
): Promise<{ text: string; exitCode: number }> {
  const reader = proc.stdout.getReader()
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const exitCode = await proc.exit
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { text: new TextDecoder().decode(merged), exitCode }
}

/**
 * Run `bin --version` (or custom args) via ProcessRunner and parse the
 * first non-empty line as the version string.
 */
export async function probeBinaryVersion(
  runner: ProcessRunner,
  bin: string,
  signal: AbortSignal,
  options?: {
    args?: readonly string[]
    env?: Readonly<Record<string, string | undefined>>
  }
): Promise<{ found: boolean; version: string | null }> {
  try {
    const proc = runner.spawn(
      {
        command: bin,
        args: options?.args ?? ["--version"],
        env: options?.env,
      },
      signal
    )
    void proc.stdin.close().catch(() => undefined)
    const { text, exitCode } = await readStdout(proc)
    if (exitCode !== 0) {
      return { found: false, version: null }
    }
    const version = text.trim().split("\n")[0]?.trim() || null
    if (!version) return { found: false, version: null }
    return { found: true, version }
  } catch {
    return { found: false, version: null }
  }
}
