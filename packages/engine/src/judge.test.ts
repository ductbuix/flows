import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  buildJudgeShellCommand,
  judgePrompt,
  runAgentJudge,
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
  writeFileSync(
    join(bin, name),
    `#!/bin/sh\nexit ${exitCode}\n`,
    { mode: 0o755 }
  )
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
    expect(
      buildJudgeShellCommand(
        { cli: "claude", instructions: "j.md" },
        "/wf/j.md"
      )
    ).toContain("claude --print --permission-mode dontAsk")
    expect(
      buildJudgeShellCommand(
        { cli: "cursor", instructions: "j.md" },
        "/wf/j.md"
      )
    ).toContain("agent -p --force --trust")
    expect(judgePrompt("/wf/j.md")).toContain("Exit with code 0")
  })

  it("passes when the stub CLI exits 0", async () => {
    installStub("claude", 0)
    const wf = tempDir("flow-judge-wf-")
    const attempt = tempDir("flow-judge-att-")
    mkdirSync(join(attempt, "out"), { recursive: true })
    writeFileSync(join(wf, "judge.md"), "pass\n")
    await expect(
      runAgentJudge({
        judge: { cli: "claude", instructions: "judge.md" },
        workflowRoot: wf,
        attemptRoot: attempt,
      })
    ).resolves.toBe(true)
  })

  it("fails when the stub CLI exits non-zero", async () => {
    installStub("agent", 2)
    const wf = tempDir("flow-judge-wf-")
    const attempt = tempDir("flow-judge-att-")
    mkdirSync(join(attempt, "out"), { recursive: true })
    writeFileSync(join(wf, "judge.md"), "fail\n")
    await expect(
      runAgentJudge({
        judge: { cli: "cursor", instructions: "judge.md" },
        workflowRoot: wf,
        attemptRoot: attempt,
      })
    ).resolves.toBe(false)
  })
})
