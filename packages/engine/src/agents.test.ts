import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  agentPrompt,
  buildAgentShellCommand,
  copyTaskMemories,
  shellSingleQuote,
} from "./agents.ts"

const homes: string[] = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "flowapp-agent-"))
  homes.push(dir)
  return dir
}

describe("agent adapters", () => {
  it("builds a headless Claude Code command", () => {
    const cmd = buildAgentShellCommand(
      {
        id: "plan",
        kind: "agent",
        cli: "claude",
        instructions: "tasks/plan.md",
        needs: [],
        spawn: true,
      },
      "/wf/tasks/plan.md"
    )
    expect(cmd).toContain("claude --print --permission-mode dontAsk")
    expect(cmd).toContain(
      shellSingleQuote(agentPrompt("/wf/tasks/plan.md", true))
    )
  })

  it("builds a headless Cursor CLI command", () => {
    const cmd = buildAgentShellCommand(
      {
        id: "plan",
        kind: "agent",
        cli: "cursor",
        instructions: "tasks/plan.md",
        needs: [],
      },
      "/wf/tasks/plan.md"
    )
    expect(cmd).toContain("agent -p --force --trust")
    expect(cmd).not.toContain("out/spawn")
  })

  it("copies listed memory files into input/memory/", () => {
    const wf = tempDir()
    mkdirSync(join(wf, "memory"), { recursive: true })
    writeFileSync(join(wf, "memory", "style.md"), "# style\n")
    writeFileSync(join(wf, "memory", "other.md"), "# other\n")
    const input = join(wf, "task-input")
    mkdirSync(input, { recursive: true })

    copyTaskMemories(
      {
        id: "plan",
        kind: "agent",
        cli: "claude",
        instructions: "tasks/plan.md",
        needs: [],
        memory: ["memory/style.md"],
      },
      wf,
      input
    )

    expect(readFileSync(join(input, "memory", "style.md"), "utf8")).toBe(
      "# style\n"
    )
    expect(() => readFileSync(join(input, "memory", "other.md"))).toThrow()
  })
})
