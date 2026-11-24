import type {
  AgentProfileInfo,
  AgentRuntime,
  AgentSession,
  Logger,
  ProcessRunner,
  SessionSpec,
} from "@workspace/core"
import { engineError } from "@workspace/core"
import type { AcpLogSink } from "./acp-log.ts"
import { cursorProfile } from "./profiles/cursor.ts"
import type { AgentProfile } from "./profiles/types.ts"
import { openAcpSession } from "./session.ts"
import { peerFromProcess } from "./streams.ts"

export type CreateAcpRuntimeOptions = {
  processRunner: ProcessRunner
  profiles?: readonly AgentProfile[]
  logger?: Logger
  clientInfo?: { name: string; version: string }
  /** Extra env merged into every spawn (e.g. PATH overrides in tests). */
  env?: Readonly<Record<string, string | undefined>>
  /** When set, every ACP JSON-RPC message is appended (secrets redacted). */
  acpLog?: AcpLogSink
  /** Secret values to redact in the ACP log. */
  secrets?: readonly string[]
}

/**
 * AgentRuntime over ACP profiles (DES-041). Default profile is Cursor.
 */
export function createAcpRuntime(
  options: CreateAcpRuntimeOptions
): AgentRuntime {
  const profiles = options.profiles ?? [cursorProfile]
  const byId = new Map(profiles.map((p) => [p.id, p]))

  return {
    profiles(): readonly AgentProfileInfo[] {
      return profiles.map((p) => ({
        id: p.id,
        modes: p.capabilities.modes,
      }))
    },

    async list(signal = new AbortController().signal) {
      const out: AgentProfileInfo[] = []
      for (const profile of profiles) {
        const probe = await profile.probe(
          options.processRunner,
          signal,
          options.env
        )
        out.push({
          id: profile.id,
          modes: profile.capabilities.modes,
          found: probe.found,
          version: probe.version,
        })
      }
      return out
    },

    async open(spec: SessionSpec, signal: AbortSignal): Promise<AgentSession> {
      const profile = byId.get(spec.profileId)
      if (!profile) {
        throw engineError(
          "not_found",
          `Unknown agent profile: ${spec.profileId}`
        )
      }

      if (spec.skills?.length) {
        await profile.placeSkills(spec.skills, spec.cwd)
      }
      if (spec.mcpServers?.length && profile.placeMcp) {
        await profile.placeMcp(spec.mcpServers, spec.cwd)
      }

      const command = profile.command(spec)
      // Own controller so a cancel that the agent ignores can end the group (BL-138).
      const procCtl = new AbortController()
      if (signal.aborted) procCtl.abort(signal.reason)
      else
        signal.addEventListener("abort", () => procCtl.abort(signal.reason), {
          once: true,
        })
      const proc = options.processRunner.spawn(
        {
          command: command.cmd,
          args: command.args,
          cwd: spec.cwd,
          env: { ...options.env, ...command.env },
        },
        procCtl.signal
      )

      const peer = peerFromProcess(proc, {
        acpLog: options.acpLog,
        secrets: options.secrets,
      })
      try {
        const session = await openAcpSession(peer, {
          cwd: spec.cwd,
          mcpServers: spec.mcpServers,
          logger: options.logger,
          signal,
          clientInfo: options.clientInfo,
          authMethod: profile.authMethod,
          kill: () => procCtl.abort(),
        })
        return wrapSession(session, () => {
          peer.close()
        })
      } catch (err) {
        peer.close()
        throw err
      }
    },
  }
}

function wrapSession(session: AgentSession, onClose: () => void): AgentSession {
  return {
    id: session.id,
    prompt: (blocks, signal) => session.prompt(blocks, signal),
    setMode: session.setMode?.bind(session),
    async close() {
      try {
        await session.close()
      } finally {
        onClose()
      }
    },
  }
}
