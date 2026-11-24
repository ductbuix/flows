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
        cli: "claude",
      },
      "/wf/tasks/plan.md",
      { workflowRoot: "/wf", attemptRoot: "/wf/runs/r/tasks/plan/attempt-1" }
    )
    expect(cmd).toContain("claude --print --permission-mode dontAsk")
    expect(cmd).toContain(`--add-dir ${shellSingleQuote("/wf")}`)
    expect(cmd).toContain(shellSingleQuote(agentPrompt("/wf/tasks/plan.md")))
    expect(cmd).not.toContain("--model")
    expect(cmd).not.toContain("--effort")
  })

  it("adds Claude model and effort flags from task and workflow", () => {
    const cmd = buildAgentShellCommand(
      {
        cli: "claude",
        model: "opus",
      },
      "/wf/tasks/plan.md",
      { workflowRoot: "/wf", attemptRoot: "/wf/runs/r/tasks/plan/attempt-1" },
      { claude: { effort: "high" } }
    )
    expect(cmd).toContain(`--model ${shellSingleQuote("opus")}`)
    expect(cmd).toContain(`--effort ${shellSingleQuote("high")}`)
  })

  it("builds a headless Cursor CLI command", () => {
    const attempt = "/wf/runs/r/tasks/plan/attempt-1"
    const cmd = buildAgentShellCommand(
      {
        cli: "cursor",
      },
      "/wf/tasks/plan.md",
      { workflowRoot: "/wf", attemptRoot: attempt }
    )
    expect(cmd).toContain("agent -p --force --trust")
    expect(cmd).toContain(`--workspace ${shellSingleQuote(attempt)}`)
    expect(cmd).toContain(`--add-dir ${shellSingleQuote("/wf")}`)
    expect(cmd).not.toMatch(/--model/)
  })

  it("adds a composed Cursor --model flag", () => {
    const cmd = buildAgentShellCommand(
      {
        cli: "cursor",
        model: "grok-4.7",
        effort: "high",
      },
      "/wf/tasks/plan.md",
      { workflowRoot: "/wf", attemptRoot: "/wf/runs/r/tasks/plan/attempt-1" }
    )
    expect(cmd).toContain(`--model ${shellSingleQuote("grok-4.7-high")}`)
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
        cli: "claude",
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
