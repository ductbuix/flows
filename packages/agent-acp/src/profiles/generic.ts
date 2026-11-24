import type { Logger, ProcessRunner } from "@workspace/core"
import { probeBinaryVersion } from "./probe.ts"
import type { AgentCommand, AgentProfile, AgentProbeResult } from "./types.ts"

/** Default modes until a generic agent advertises its own. */
export const GENERIC_MODES = ["agent"] as const

/**
 * Settings for a spec-only ACP profile (DES-041 / BL-150).
 * `env` lists host env var names to forward; values are not stored here.
 */
export type GenericProfileSettings = {
  command: string
  args?: readonly string[]
  /** Host env var names forwarded into the agent process. */
  env?: readonly string[]
  authMethod?: string
  /** Profile id (default `generic`). */
  id?: string
  modes?: readonly string[]
  logger?: Logger
}

/**
 * Build an AgentProfile that uses only ACP spec methods. Vendor
 * extensions (e.g. `cursor/*`) are ignored with a log line.
 */
export function createGenericProfile(
  settings: GenericProfileSettings
): AgentProfile {
  const id = settings.id ?? "generic"
  const args = [...(settings.args ?? [])]
  const envNames = [...(settings.env ?? [])]
  const modes = [...(settings.modes ?? GENERIC_MODES)]

  settings.logger?.info("ACP generic profile ignores extensions", {
    profileId: id,
  })

  return {
    id,
    command(): AgentCommand {
      const env: Record<string, string | undefined> = {}
      for (const name of envNames) {
        env[name] = process.env[name]
      }
      return { cmd: settings.command, args: [...args], env }
    },
    ...(settings.authMethod !== undefined
      ? { authMethod: settings.authMethod }
      : {}),
    capabilities: {
      mcpParam: true,
      setModel: false,
      modes,
    },
    async placeSkills() {
      // Spec agents have no skill layout; skills stay unused (BL-150).
    },
    extensions: {},
    probe(
      runner: ProcessRunner,
      signal: AbortSignal,
      env?: Readonly<Record<string, string | undefined>>
    ): Promise<AgentProbeResult> {
      return probeBinaryVersion(runner, settings.command, signal, { env })
    },
  }
}
