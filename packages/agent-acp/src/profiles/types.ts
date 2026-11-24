import type { ProcessRunner, SessionSpec } from "@workspace/core"

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
 * extensions land in later BLs; stubs keep the shape stable.
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
  placeSkills(skills: readonly string[], workDir: string): Promise<void>
  placeMcp?(servers: readonly unknown[], workDir: string): Promise<void>
  extensions: Record<string, unknown>
  /** Probe PATH for this CLI (`agent --version` for Cursor). */
  probe(
    runner: ProcessRunner,
    signal: AbortSignal,
    env?: Readonly<Record<string, string | undefined>>
  ): Promise<AgentProbeResult>
}
