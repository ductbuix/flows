import type { ProcessRunner, SessionSpec } from "@workspace/core"
import { probeBinaryVersion } from "./probe.ts"
import type { AgentCommand, AgentProfile, AgentProbeResult } from "./types.ts"

/** Cursor ACP auth method id (DES-041). */
export const CURSOR_AUTH_METHOD = "cursor_login"

/** Modes Cursor exposes until setMode/setModel are verified. */
export const CURSOR_MODES = ["agent", "ask", "plan"] as const

/**
 * Build `agent [--model m] acp` for Cursor (BL-140). mcpParam and
 * setModel stay false until verified against a live agent.
 */
export function cursorCommand(spec: SessionSpec): AgentCommand {
  const args: string[] = []
  if (spec.model) {
    args.push("--model", spec.model)
  }
  args.push("acp")
  return { cmd: "agent", args, env: {} }
}

export async function probeCursor(
  runner: ProcessRunner,
  signal: AbortSignal,
  env?: Readonly<Record<string, string | undefined>>
): Promise<AgentProbeResult> {
  return probeBinaryVersion(runner, "agent", signal, { env })
}

export const cursorProfile: AgentProfile = {
  id: "cursor",
  command: cursorCommand,
  authMethod: CURSOR_AUTH_METHOD,
  capabilities: {
    mcpParam: false,
    setModel: false,
    modes: [...CURSOR_MODES],
  },
  async placeSkills() {
    // BL-170
  },
  extensions: {},
  probe: probeCursor,
}
