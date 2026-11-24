import { beforeEach, describe, expect, it } from "vitest"
import type {
  ProcessRunner,
  ProcessSpawnSpec,
} from "../ports/process-runner.ts"

export type ProcessRunnerTestCtx = {
  runner: ProcessRunner
  /** Existing directory safe to use as a sandbox workflow root. */
  sandboxRoot: string
  /** Spec that prints `text` on stdout and exits 0. */
  echoSpec(text: string): ProcessSpawnSpec
  /** Spec that exits with `code` and optional stderr. */
  exitSpec(code: number, stderr?: string): ProcessSpawnSpec
  /** Spec that hangs until aborted. */
  hangSpec(): ProcessSpawnSpec
}

export type ProcessRunnerFactory = () => ProcessRunnerTestCtx

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
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

export function describeProcessRunnerContract(
  title: string,
  factories: ReadonlyArray<readonly [string, ProcessRunnerFactory]>
): void {
  describe.each(factories)(`${title} (%s)`, (_label, create) => {
    let ctx: ProcessRunnerTestCtx

    beforeEach(() => {
      ctx = create()
    })

    it("spawns, yields stdout, and resolves exit 0", async () => {
      const proc = ctx.runner.spawn(
        ctx.echoSpec("hello"),
        new AbortController().signal
      )
      const [out, code] = await Promise.all([readAll(proc.stdout), proc.exit])
      expect(code).toBe(0)
      expect(out).toContain("hello")
      expect(proc.pid).toBeGreaterThan(0)
    })

    it("surfaces a non-zero exit code and stderr", async () => {
      const proc = ctx.runner.spawn(
        ctx.exitSpec(7, "boom"),
        new AbortController().signal
      )
      const [err, code] = await Promise.all([readAll(proc.stderr), proc.exit])
      expect(code).toBe(7)
      expect(err).toContain("boom")
    })

    it("abort ends a hanging process", async () => {
      const ac = new AbortController()
      const proc = ctx.runner.spawn(ctx.hangSpec(), ac.signal)
      ac.abort()
      const code = await proc.exit
      expect(code).not.toBe(0)
    })

    it("records sandboxed when a sandbox profile is in the spec", async () => {
      const spec = ctx.echoSpec("x")
      spec.sandbox = { workflowRoot: ctx.sandboxRoot }
      const proc = ctx.runner.spawn(spec, new AbortController().signal)
      await proc.exit
      expect(typeof proc.sandboxed).toBe("boolean")
      // Fake always sandboxes when profile is set; Node may fall back.
      if (_label === "fake") expect(proc.sandboxed).toBe(true)
    })
  })
}
