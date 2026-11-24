import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { Readable, Writable } from "node:stream"
import { describe, expect, it } from "vitest"
import type {
  ProcessRunner,
  ProcessSpawnSpec,
  RunningProcess,
} from "@workspace/core"
import { createFakeProcessRunner } from "@workspace/core/testing"
import {
  CURSOR_AUTH_METHOD,
  CURSOR_MODES,
  cursorCommand,
  cursorProfile,
  probeCursor,
} from "./cursor.ts"

describe("cursorCommand", () => {
  it("spawns agent acp with cwd left to ProcessRunner", () => {
    expect(cursorCommand({ profileId: "cursor", cwd: "/work" })).toEqual({
      cmd: "agent",
      args: ["acp"],
      env: {},
    })
  })

  it("passes --model before acp when model is set", () => {
    expect(
      cursorCommand({
        profileId: "cursor",
        cwd: "/work",
        model: "composer-1",
      })
    ).toEqual({
      cmd: "agent",
      args: ["--model", "composer-1", "acp"],
      env: {},
    })
  })
})

describe("cursorProfile", () => {
  it("keeps mcpParam and setModel false until verified", () => {
    expect(cursorProfile.id).toBe("cursor")
    expect(cursorProfile.authMethod).toBe(CURSOR_AUTH_METHOD)
    expect(cursorProfile.capabilities).toEqual({
      mcpParam: false,
      setModel: false,
      modes: [...CURSOR_MODES],
    })
  })

  it("reports found with version via FakeProcessRunner", async () => {
    const runner = createFakeProcessRunner()
    runner.on("agent", (spec) => {
      expect(spec.args).toEqual(["--version"])
      return { stdout: "2024.11.0\n", exitCode: 0 }
    })
    await expect(
      probeCursor(runner, new AbortController().signal)
    ).resolves.toEqual({ found: true, version: "2024.11.0" })
  })

  it("reports missing when the binary exits non-zero", async () => {
    const runner = createFakeProcessRunner()
    runner.on("agent", () => ({ exitCode: 127, stderr: "not found\n" }))
    await expect(
      probeCursor(runner, new AbortController().signal)
    ).resolves.toEqual({ found: false, version: null })
  })

  it("finds a stub agent binary on PATH", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flows-agent-stub-"))
    const stub = join(dir, "agent")
    writeFileSync(stub, "#!/bin/sh\necho 'stub-9.9.9'\n")
    chmodSync(stub, 0o755)

    const runner = createPathProcessRunner()
    const pathEnv = {
      ...process.env,
      PATH: `${dir}:${process.env.PATH ?? ""}`,
    }
    await expect(
      probeCursor(runner, new AbortController().signal, pathEnv)
    ).resolves.toEqual({ found: true, version: "stub-9.9.9" })
  })
})

/** Minimal ProcessRunner that honors PATH for stub-binary tests. */
function createPathProcessRunner(): ProcessRunner {
  return {
    spawn(spec: ProcessSpawnSpec, signal: AbortSignal): RunningProcess {
      const child = spawn(spec.command, [...(spec.args ?? [])], {
        cwd: spec.cwd,
        env: spec.env as NodeJS.ProcessEnv | undefined,
        stdio: ["pipe", "pipe", "pipe"],
      })
      if (!child.stdin || !child.stdout || !child.stderr || child.pid == null) {
        throw new Error("spawn failed")
      }
      const exit = new Promise<number>((resolve) => {
        const onAbort = () => {
          child.kill("SIGTERM")
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener("abort", onAbort, { once: true })
        child.once("exit", (code) => {
          signal.removeEventListener("abort", onAbort)
          resolve(code ?? 1)
        })
        child.once("error", () => {
          signal.removeEventListener("abort", onAbort)
          resolve(1)
        })
      })
      return {
        pid: child.pid,
        stdin: Writable.toWeb(child.stdin),
        stdout: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>,
        exit,
        sandboxed: false,
      }
    },
  }
}
