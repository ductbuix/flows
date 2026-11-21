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
  workItemsRoot,
  workItemDir,
  runDir,
  taskDir,
  attemptDir,
  connectionsDir,
  connectionDir,
  secretsDir,
} from "./paths.ts"
export {
  listConnections,
  readConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  workflowsUsingConnection,
  collectWorkflowUses,
  type ConnectionStoreError,
  type ConnectionStoreResult,
} from "./connections.ts"
export {
  registerConnector,
  unregisterConnector,
  getConnector,
  listConnectors,
  clearConnectors,
  fakeConnector,
  type Connector,
  type ConnectorChangeSet,
  type ConnectorPublishResult,
} from "./connectors/index.ts"
export {
  hashText,
  writeAtomic,
  newWorkItemId,
  readWorkItem,
  listWorkItemSummaries,
  createWorkItem,
  updateWorkItem,
  deleteWorkItem,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
  type UpdateWorkItemResult,
  type DeleteWorkItemResult,
} from "./workitems.ts"
export {
  readWorkItemNotes,
  writeWorkItemNotes,
  listWorkItemAttachments,
  writeWorkItemAttachment,
  deleteWorkItemAttachment,
  type WriteNotesResult,
  type AttachmentWriteResult,
  type AttachmentDeleteResult,
} from "./workitem-files.ts"
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
export {
  listCliModels,
  readCliDefaults,
  parseCursorListOutput,
  type CliDefaults,
} from "./cli-models.ts"
export { composeClaudeFlags, composeCursorFlags } from "./compose-flags.ts"
export {
  parseCursorModelList,
  parseCursorModelId,
  composeCursorModelId,
} from "./cursor-model-families.ts"
export type { CliTrustValue } from "@workspace/shared"

export { manualItemKey } from "./item-key.ts"
export { summarizeRun, type ListRunSummariesOptions } from "./run-summary.ts"
