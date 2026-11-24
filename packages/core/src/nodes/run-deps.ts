import type { AcpInboxGates } from "../agents/acp-inbox-answer.ts"
import type { DocumentStore } from "../ports/document-store.ts"
import type { ProcessRunner } from "../ports/process-runner.ts"
import type { PublishPort } from "../ports/publish.ts"
import type { RunState } from "../runs/model.ts"
import type { NodeKindRegistry } from "./registry.ts"

export type NoticePost = {
  key: string
  title: string
  text: string
  runId: string
  workflowId: string
  nodeId: string
  at: string
  /** `system` also shows a system notification on the desktop host. */
  channel?: "app" | "system"
}

export type NodeEffectRunnerDeps = {
  docs: DocumentStore
  registry?: NodeKindRegistry
  /** Run folder under the store, e.g. `workflows/wf/runs/r1`. */
  runDirOf: (state: RunState) => string
  /** Optional notice sink for the `notify` effect. */
  postNotice?: (n: NoticePost) => void
  now?: () => string
  /** Absolute cwd resolver for agent sessions (llm / condition). */
  agentCwdOf?: (state: RunState, nodeId: string, pass: number) => string
  agentRuntime?: import("../ports/agent-runtime.ts").AgentRuntime
  /**
   * When set with `workflowDirOf`, `command` nodes spawn via ProcessRunner
   * instead of the process-kind stub (BL-194).
   */
  process?: ProcessRunner
  workflowDirOf?: (state: RunState) => string
  /** Passed through to command spawns (host: `process.env`). */
  processEnv?: Readonly<Record<string, string | undefined>>
  /** Absolute path resolver for process cwd / NODE_OUT. */
  absolutePathOf?: (storePath: string) => string
  /** Per-run abort signal so host cancel can kill a spawn. */
  signalOf?: (state: RunState) => AbortSignal | undefined
  /** Live ACP ask gates for llm/agent/judge-rule (BL-195). */
  acpAsks?: AcpInboxGates
  /** Connector publish for output target=publish. */
  publish?: PublishPort
}
