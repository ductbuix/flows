import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { AgentJudge, AgentTask } from "@workspace/shared"
import {
  agentPrompt,
  judgePrompt,
  shellSingleQuote,
  type AgentLaunchPaths,
} from "./agent-prompt.ts"
import {
  removeCursorTrustMarker,
  writeCursorTrustMarker,
} from "./cursor-trust.ts"

const execFileAsync = promisify(execFile)

export type CliKind = AgentTask["cli"]

export type CliAdapter = {
  id: CliKind
  buildAgentCommand: (
    task: AgentTask,
    instructionsAbsPath: string,
    paths: AgentLaunchPaths
  ) => string
  buildJudgeCommand: (judge: AgentJudge, instructionsAbsPath: string) => string
  prepareTrust: (homePath: string, workflowDir?: string) => void
  cleanupTrust: (homePath: string, workflowDir?: string) => void
  failurePatterns: readonly string[]
  probeVersion: () => Promise<string | null>
  /** Exact flags shown in the pre-run dialog (DES-019). */
  describeFlags: () => string
}

const claudeAdapter: CliAdapter = {
  id: "claude",
  buildAgentCommand(task, instructionsAbsPath, paths) {
    const prompt = shellSingleQuote(
      agentPrompt(instructionsAbsPath, task.spawn === true)
    )
    const wf = shellSingleQuote(paths.workflowRoot)
    return `claude --print --permission-mode dontAsk --add-dir ${wf} -- ${prompt}`
  },
  buildJudgeCommand(_judge, instructionsAbsPath) {
    const prompt = shellSingleQuote(judgePrompt(instructionsAbsPath))
    return `claude --print --permission-mode dontAsk -- ${prompt}`
  },
  prepareTrust() {},
  cleanupTrust() {},
  failurePatterns: [],
  async probeVersion() {
    return probeCliVersion("claude", ["--version"])
  },
  describeFlags() {
    return "claude --print --permission-mode dontAsk --add-dir <workflow>"
  },
}

const cursorAdapter: CliAdapter = {
  id: "cursor",
  buildAgentCommand(task, instructionsAbsPath, paths) {
    const prompt = shellSingleQuote(
      agentPrompt(instructionsAbsPath, task.spawn === true)
    )
    const wf = shellSingleQuote(paths.workflowRoot)
    const attempt = shellSingleQuote(paths.attemptRoot)
    return `agent -p --force --trust --workspace ${attempt} --add-dir ${wf} -- ${prompt}`
  },
  buildJudgeCommand(_judge, instructionsAbsPath) {
    const prompt = shellSingleQuote(judgePrompt(instructionsAbsPath))
    return `agent -p --force --trust -- ${prompt}`
  },
  prepareTrust(homePath, workflowDir) {
    // Home first; workflow-dir fallback after BL-018 live check showed
    // attempt workspaces do not always inherit from FLOWAPP_HOME.
    writeCursorTrustMarker(homePath)
    if (workflowDir) writeCursorTrustMarker(workflowDir)
  },
  cleanupTrust(homePath, workflowDir) {
    removeCursorTrustMarker(homePath)
    if (workflowDir) removeCursorTrustMarker(workflowDir)
  },
  failurePatterns: [
    "Failed to create trust marker",
    "Failed to trust workspace",
    "Workspace Trust Required",
  ],
  async probeVersion() {
    return probeCliVersion("agent", ["--version"])
  },
  describeFlags() {
    return (
      "agent -p --force --trust --workspace <attempt> --add-dir <workflow> " +
      "(--force auto-approves tool actions)"
    )
  },
}

export const cliAdapters: Record<CliKind, CliAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
}

export function getCliAdapter(cli: CliKind): CliAdapter {
  return cliAdapters[cli]
}

async function probeCliVersion(
  bin: string,
  args: string[]
): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: 5000,
      encoding: "utf8",
    })
    const text = `${stdout}${stderr}`.trim().split("\n")[0]?.trim()
    return text || null
  } catch {
    return null
  }
}
