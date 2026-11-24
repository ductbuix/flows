import type { ProcessRunner, SessionSpec } from "@workspace/core"
import type { McpLaunchSpec } from "./place-mcp.ts"

/** Spawn argv for one ACP agent CLI (DES-041). */
export type AgentCommand = {
  cmd: string
  args: string[]
  env: Record<string, string | undefined>
}

export type AgentProbeResult = {
  found: boolean
  version: string | null
}

/**
 * Strategy for one agent CLI (DES-041). placeSkills / placeMcp and
 * cleanup are profile-specific (Cursor: `.cursor/` layout).
 */
export type AgentProfile = {
  id: string
  command(spec: SessionSpec): AgentCommand
  authMethod?: string
  capabilities: {
    mcpParam: boolean
    setModel: boolean
    modes: string[]
  }
  /** BL-170 fills this; stub accepts slugs until skills are placed. */
  placeSkills(skills: readonly string[], workDir: string): Promise<void>
  placeMcp?(servers: readonly McpLaunchSpec[], workDir: string): Promise<void>
  /** Remove files this profile placed for the step (BL-170). */
  cleanup?(workDir: string): Promise<void>
  extensions: Record<string, unknown>
  /** Probe PATH for this CLI (`agent --version` for Cursor). */
  probe(
    runner: ProcessRunner,
    signal: AbortSignal,
    env?: Readonly<Record<string, string | undefined>>
  ): Promise<AgentProbeResult>
}
