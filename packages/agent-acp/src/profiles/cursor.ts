import type { ProcessRunner, SessionSpec, Skill } from "@workspace/core"
import { CURSOR_ASK_QUESTION_METHOD } from "../ask-question.ts"
import { CURSOR_CREATE_PLAN_METHOD } from "../create-plan.ts"
import { cleanupPlacedMcp, placeMcp, type McpLaunchSpec } from "./place-mcp.ts"
import {
  cleanupPlacedSkills,
  placeSkills as placeCursorSkills,
} from "./place-skills.ts"
import { probeBinaryVersion } from "./probe.ts"
import type { AgentCommand, AgentProfile, AgentProbeResult } from "./types.ts"

/** Cursor ACP auth method id (DES-041). */
export const CURSOR_AUTH_METHOD = "cursor_login"

export { CURSOR_ASK_QUESTION_METHOD, CURSOR_CREATE_PLAN_METHOD }

/** Modes Cursor exposes until setMode/setModel are verified. */
export const CURSOR_MODES = ["agent", "ask", "plan"] as const

/**
 * Build `agent [--model m] acp` for Cursor (BL-140). setModel stays
 * false until verified; mcpParam is true after the BL-167 live probe.
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
    mcpParam: true,
    setModel: false,
    modes: [...CURSOR_MODES],
  },
  async placeSkills(skills: readonly Skill[], workDir: string) {
    await placeCursorSkills(skills, workDir)
  },
  async placeMcp(servers: readonly McpLaunchSpec[], workDir: string) {
    await placeMcp(servers, workDir)
  },
  async cleanup(workDir: string) {
    await cleanupPlacedSkills(workDir)
    await cleanupPlacedMcp(workDir)
  },
  extensions: {
    /** Inbox question; handler wired on the ACP session (BL-147). */
    [CURSOR_ASK_QUESTION_METHOD]: true,
    /** Plan review; handler wired on the ACP session (BL-148). */
    [CURSOR_CREATE_PLAN_METHOD]: true,
  },
  probe: probeCursor,
}
