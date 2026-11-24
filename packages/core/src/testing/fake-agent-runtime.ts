import type {
  AgentEvent,
  AgentProfileInfo,
  AgentRuntime,
  AgentSession,
  ContentBlock,
  SessionSpec,
} from "../ports/agent-runtime.ts"

export type FakeAgentPrompt = {
  spec: SessionSpec
  blocks: readonly ContentBlock[]
}

export type FakeAgentHandler = (
  prompt: FakeAgentPrompt,
  signal: AbortSignal
) => AsyncIterable<AgentEvent> | Promise<AsyncIterable<AgentEvent>>

export type FakeAgentRuntime = AgentRuntime & {
  readonly opens: readonly SessionSpec[]
  readonly prompts: readonly FakeAgentPrompt[]
  onPrompt(handler: FakeAgentHandler): FakeAgentRuntime
}

/**
 * In-memory AgentRuntime for node kind tests (BL-142). Never talks to a
 * real CLI; the test script yields AgentEvents from `onPrompt`.
 */
export function createFakeAgentRuntime(
  profiles: readonly AgentProfileInfo[] = [
    { id: "cursor", modes: ["agent", "ask", "plan"] },
  ]
): FakeAgentRuntime {
  const opens: SessionSpec[] = []
  const prompts: FakeAgentPrompt[] = []
  let handler: FakeAgentHandler = async function* () {
    yield { kind: "stop", reason: "end_turn" }
  }
  let nextId = 1

  const runtime: FakeAgentRuntime = {
    get opens() {
      return opens
    },
    get prompts() {
      return prompts
    },
    onPrompt(next) {
      handler = next
      return runtime
    },
    profiles() {
      return profiles
    },
    async list() {
      return profiles.map((p) => ({ ...p, found: true, version: "0.0.0" }))
    },
    async open(spec: SessionSpec): Promise<AgentSession> {
      opens.push(spec)
      const id = `fake_${nextId++}`
      let closed = false
      return {
        id,
        async *prompt(blocks, signal) {
          if (closed) throw new Error("session closed")
          const entry = { spec, blocks }
          prompts.push(entry)
          const events = await handler(entry, signal)
          yield* events
        },
        async setMode() {
          /* no-op */
        },
        async close() {
          closed = true
        },
      }
    },
  }
  return runtime
}
