export {
  createEngine,
  Engine,
  type CreateEngineOptions,
  type RunHandle,
  type StartRunOptions,
} from "./engine.ts"
export {
  foldEvents,
  readyTaskIds,
  approvedAwaitingIds,
  openAttempts,
  hasOpenAttempts,
  isOpenAttempt,
  isUnfinishedTask,
  isLiveRunStatus,
  type RunState,
  type TaskState,
  type AttemptState,
} from "./fold.ts"
export type { ManualFilePart } from "./source-manual.ts"
export { EventLog, type StoredEvent } from "./event-log.ts"
export {
  resolveAppHome,
  resolveAppHomeRealpath,
  appDbPath,
  workflowDir,
  runDir,
  taskDir,
  attemptDir,
} from "./paths.ts"
export { runInputDir } from "./run-input.ts"
export { loadWorkflowFile, assertValidGraph } from "./workflow.ts"
export { decideTrust, isAlwaysTrusted } from "./trust-policy.ts"
export {
  sanitizeCursorProjectPath,
  cursorTrustMarkerPath,
  cursorPathVariants,
  writeCursorTrustMarker,
  removeCursorTrustMarker,
  readCursorTrustMarker,
  pathComponentCount,
  resolveCursorProjectsDir,
} from "./cursor-trust.ts"
export { workflowNeedsAgentCli, workflowAgentClis } from "./workflow-agents.ts"
export { runPreflightChecks, hasWarning } from "./preflight.ts"
export {
  checkPathInsideHome,
  isInsideRealpath,
  tryRealpath,
} from "./path-checks.ts"
export {
  getCliAdapter,
  cliAdapters,
  type CliAdapter,
  type CliKind,
} from "./cli-adapters.ts"
export type { CliTrustValue } from "@workspace/shared"

export { manualItemKey } from "./item-key.ts"
