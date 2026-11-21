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
  secretsRoot,
  secretsDir,
  libraryDir,
  libraryEntityDir,
  encodeEntityId,
  decodeEntityId,
} from "./paths.ts"
export {
  cookiesPath,
  profileDir,
  ensureSecretsDir,
  readCookies,
  writeCookies,
  isSignedIn,
  removeSignIn,
  type StoredCookie,
} from "./secrets.ts"
export {
  BrowserSignInError,
  connectionSignInHost,
  signInWithBrowser,
  type BrowserSignInResult,
} from "./browser-sign-in.ts"
export {
  LIBRARY_EVENT_RUN_ID,
  resolveScopeEntity,
  pullEntity,
  linkRunResources,
  readResourcesJson,
  type ScopeEntity,
  type PullEntityResult,
} from "./library.ts"
export { materializeRunResources, pullNow } from "./library-run.ts"
export { listLibrary } from "./library-list.ts"
export { isFresh, currentRevision, readRevisionMeta } from "./library-paths.ts"
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
  registerBuiltinConnectors,
  fakeConnector,
  githubConnector,
  createGithubConnector,
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

export { manualItemKey, workItemItemKey } from "./item-key.ts"
export { summarizeRun, type ListRunSummariesOptions } from "./run-summary.ts"
export {
  DEFAULT_PORT_COUNT,
  PORT_RANGE_START,
  portLeaseKey,
  portLeases,
  type PortBlock,
} from "./port-lease.ts"
export { serialLocks, type SerialHolder } from "./serial-lock.ts"
export {
  ensureWorkCopies,
  copyPinnedEntity,
  workConnectionDir,
  workEntityDir,
  diffWorkCopy,
  recordUnpublishedLocalEffects,
  listWorkConnections,
  removeWorkCopies,
  ensureLibraryGcAutoOff,
  advanceWorkCopyBase,
  publishChangesDir,
  workPublishBaseDir,
} from "./work-copy.ts"
export {
  assertPublishTasksValid,
  runPublishTask,
  resumeInFlightPublishes,
  hasOpenPublish,
} from "./publish.ts"
export {
  workflowCacheEnv,
  WORKFLOW_CACHE_ENV_TEMPLATES,
} from "./task-cache-env.ts"
export {
  copyWorkflowExport,
  isWorkflowExportOmitted,
} from "./workflow-export.ts"
