import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type {
  AgentJudge,
  AgentTask,
  CliModelCatalog,
  ResolvedModelEffort,
} from "@workspace/shared"
import {
  agentPrompt,
  judgePrompt,
  shellSingleQuote,
  type AgentLaunchPaths,
} from "./agent-prompt.ts"
import {
  composeClaudeFlags,
  composeCursorFlags,
  flagsToShell,
  type ComposeFlagsInput,
} from "./compose-flags.ts"
import {
  listCliModels,
  readCliDefaults,
  type CliDefaults,
} from "./cli-models.ts"
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
    paths: AgentLaunchPaths,
    resolved: ResolvedModelEffort
  ) => string
  buildJudgeCommand: (
    judge: AgentJudge,
    instructionsAbsPath: string,
    resolved: ResolvedModelEffort,
    /** Replaces the exit-code prompt, e.g. for a Judge node (DES-032). */
    prompt?: string
  ) => string
  /** One model call with no tools; the prompt comes from a file on stdin (DES-032). */
  buildLlmCommand: (
    promptAbsPath: string,
    resolved: ResolvedModelEffort
  ) => string
  prepareTrust: (homePath: string, workflowDir?: string) => void
  cleanupTrust: (homePath: string, workflowDir?: string) => void
  failurePatterns: readonly string[]
  probeVersion: () => Promise<string | null>
  /** Exact flags shown in the pre-run dialog (DES-019). */
  describeFlags: () => string
  /** Read CLI settings; never write (DES-023). */
  readDefaults: () => CliDefaults
  listModels: () => Promise<CliModelCatalog>
  composeFlags: (input: ComposeFlagsInput) => string[]
}

const claudeAdapter: CliAdapter = {
  id: "claude",
  buildAgentCommand(task, instructionsAbsPath, paths, resolved) {
    const prompt = shellSingleQuote(
      agentPrompt(instructionsAbsPath, task.spawn === true)
    )
    const wf = shellSingleQuote(paths.workflowRoot)
    const flags = flagsToShell(this.composeFlags(resolved))
    return `claude --print --permission-mode dontAsk${flags} --add-dir ${wf} -- ${prompt}`
  },
  buildJudgeCommand(_judge, instructionsAbsPath, resolved, text) {
    const prompt = shellSingleQuote(text ?? judgePrompt(instructionsAbsPath))
    const flags = flagsToShell(this.composeFlags(resolved))
    return `claude --print --permission-mode dontAsk${flags} -- ${prompt}`
  },
  buildLlmCommand(promptAbsPath, resolved) {
    const flags = flagsToShell(this.composeFlags(resolved))
    return `claude --print --tools "" --permission-mode dontAsk --no-session-persistence${flags} < ${shellSingleQuote(promptAbsPath)}`
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
  readDefaults() {
    return readCliDefaults("claude")
  },
  listModels() {
    return listCliModels("claude")
  },
  composeFlags(input) {
    return composeClaudeFlags(input)
  },
}

const cursorAdapter: CliAdapter = {
  id: "cursor",
  buildAgentCommand(task, instructionsAbsPath, paths, resolved) {
    const prompt = shellSingleQuote(
      agentPrompt(instructionsAbsPath, task.spawn === true)
    )
    const wf = shellSingleQuote(paths.workflowRoot)
    const attempt = shellSingleQuote(paths.attemptRoot)
    const flags = flagsToShell(this.composeFlags(resolved))
    return `agent -p --force --trust${flags} --workspace ${attempt} --add-dir ${wf} -- ${prompt}`
  },
  buildJudgeCommand(_judge, instructionsAbsPath, resolved, text) {
    const prompt = shellSingleQuote(text ?? judgePrompt(instructionsAbsPath))
    const flags = flagsToShell(this.composeFlags(resolved))
    return `agent -p --force --trust${flags} -- ${prompt}`
  },
  buildLlmCommand(promptAbsPath, resolved) {
    const flags = flagsToShell(this.composeFlags(resolved))
    return `agent -p --mode ask --trust${flags} < ${shellSingleQuote(promptAbsPath)}`
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
  readDefaults() {
    return readCliDefaults("cursor")
  },
  listModels() {
    return listCliModels("cursor")
  },
  composeFlags(input) {
    let model = input.model
    if (!model && input.effort) {
      model = this.readDefaults().model
    }
    return composeCursorFlags({ model, effort: input.effort })
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
