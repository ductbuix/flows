import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { shellSingleQuote } from "./agent-prompt.ts"
import {
  buildJudgeShellCommand,
  judgePrompt,
  runAgentJudgeDetailed,
} from "./judge.ts"

const dirs: string[] = []
const prevPath = process.env.PATH

afterEach(() => {
  process.env.PATH = prevPath
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function tempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(root)
  return root
}

function installStub(name: "claude" | "agent", exitCode: number): string {
  const bin = tempDir("flow-judge-bin-")
  writeFileSync(join(bin, name), `#!/bin/sh\nexit ${exitCode}\n`, {
    mode: 0o755,
  })
  if (name === "claude") {
    writeFileSync(join(bin, "agent"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  } else {
    writeFileSync(join(bin, "claude"), "#!/bin/sh\nexit 1\n", { mode: 0o755 })
  }
  process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
  return bin
}

describe("judge adapters", () => {
  it("builds claude and cursor judge commands", () => {
    expect(buildJudgeShellCommand({ cli: "claude" }, "/wf/j.md")).toContain(
      "claude --print --permission-mode dontAsk"
    )
    expect(buildJudgeShellCommand({ cli: "cursor" }, "/wf/j.md")).toContain(
      "agent -p --force --trust"
    )
    expect(judgePrompt("/wf/j.md")).toContain("Exit with code 0")
  })

  it("adds resolved model flags to judge commands", () => {
    const claude = buildJudgeShellCommand(
      { cli: "claude", model: "haiku", effort: "low" },
      "/wf/j.md"
    )
    expect(claude).toContain(`--model ${shellSingleQuote("haiku")}`)
    expect(claude).toContain(`--effort ${shellSingleQuote("low")}`)
    const cursor = buildJudgeShellCommand(
      { cli: "cursor", model: "auto" },
      "/wf/j.md",
      {
        parentTask: {
          cli: "cursor",
          effort: "high",
        },
      }
    )
    expect(cursor).toContain(`--model ${shellSingleQuote("auto-high")}`)
  })

  it("passes when the stub CLI exits 0", async () => {
    installStub("claude", 0)
    const wf = tempDir("flow-judge-wf-")
    const attempt = tempDir("flow-judge-att-")
    mkdirSync(join(attempt, "out"), { recursive: true })
    const path = join(wf, "judge.md")
    writeFileSync(path, "pass\n")
    await expect(
      runAgentJudgeDetailed({
        judge: { cli: "claude" },
        instructionsAbsPath: path,
        workflowRoot: wf,
        attemptRoot: attempt,
      })
    ).resolves.toMatchObject({ ok: true })
  })

  it("fails when the stub CLI exits non-zero", async () => {
    installStub("agent", 2)
    const wf = tempDir("flow-judge-wf-")
    const attempt = tempDir("flow-judge-att-")
    mkdirSync(join(attempt, "out"), { recursive: true })
    const path = join(wf, "judge.md")
    writeFileSync(path, "fail\n")
    await expect(
      runAgentJudgeDetailed({
        judge: { cli: "cursor" },
        instructionsAbsPath: path,
        workflowRoot: wf,
        attemptRoot: attempt,
      })
    ).resolves.toMatchObject({ ok: false })
  })

  it("fails when the judge exceeds its timeout", async () => {
    const bin = tempDir("flow-judge-bin-")
    writeFileSync(join(bin, "claude"), "#!/bin/sh\nsleep 5\nexit 0\n", {
      mode: 0o755,
    })
    process.env.PATH = `${bin}:${process.env.PATH ?? ""}`
    const wf = tempDir("flow-judge-wf-")
    const attempt = tempDir("flow-judge-att-")
    mkdirSync(join(attempt, "out"), { recursive: true })
    const path = join(wf, "judge.md")
    writeFileSync(path, "pass\n")
    const start = Date.now()
    await expect(
      runAgentJudgeDetailed({
        judge: { cli: "claude" },
        instructionsAbsPath: path,
        workflowRoot: wf,
        attemptRoot: attempt,
        timeoutSeconds: 1,
      })
    ).resolves.toMatchObject({ ok: false })
    expect(Date.now() - start).toBeLessThan(4000)
  })
})
