/** App host leftovers moved from `@workspace/adapters-node` (BL-214). */

export { createEngine, Engine, type CreateEngineOptions } from "./engine.ts"
export { ensureBlobStore, getBlobStore, setBlobStore } from "./blob-store.ts"
export { EventLog, type StoredEvent } from "./event-log.ts"
export {
  resolveAppHome,
  resolveAppHomeRealpath,
  appDbPath,
  workflowDir,
  runDir,
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
  LIBRARY_EVENT_RUN_ID,
  resolveScopeEntity,
  pullEntity,
  linkRunResources,
  readResourcesJson,
  type ScopeEntity,
  type PullEntityResult,
} from "./library.ts"
export {
  materializeNodeRunResources,
  pullNow,
  type MaterializeResourcesResult,
} from "./library-run.ts"
export { listLibrary } from "./library-list.ts"
export { isFresh, currentRevision, readRevisionMeta } from "./library-paths.ts"
export {
  LIBRARY_RETENTION_MS,
  LIBRARY_RETENTION_INTERVAL_MS,
  sweepLibrary,
  clearEntityRevisions,
  connectionHasLiveWorkCopy,
  pruneIdleClonesAsync,
} from "./library-retention.ts"
export {
  LibraryCapError,
  libraryMaxBytes,
  libraryUsage,
  assertLibraryHasSpace,
  formatBytes,
  pathByteSize,
} from "./library-usage.ts"
export { listPinningRuns, pinnedRevisionKeys } from "./library-pins.ts"
/** TODO(BL-213): connection store deleted with old domain contracts. */
export {
  listConnections,
  readConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  workflowsUsingConnection,
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
  confluenceConnector,
  createConfluenceConnector,
  MCP_TRUST_REQUIRED,
  rallyConnector,
  createRallyConnector,
  type Connector,
  type ConnectorChangeSet,
  type ConnectorPublishResult,
} from "./connectors/index.ts"
export {
  copyPinnedEntity,
  workConnectionDir,
  workEntityDir,
  diffWorkCopy,
  recordUnpublishedLocalEffects,
  listWorkConnections,
  removeWorkCopies,
  ensureLibraryGcAutoOff,
  ensureWorkCopiesFor,
  advanceWorkCopyBase,
  publishChangesDir,
  workPublishBaseDir,
} from "./work-copy.ts"
export { hasOpenPublish } from "./publish.ts"
export {
  runInputDir,
  materializeRunInput,
  type MaterializeRunInputResult,
} from "./run-input.ts"
export { manualSource } from "./source-manual.ts"
export type { ManualFilePart, ManualItem } from "./source-manual.ts"
export { manualItemKey, workItemItemKey } from "./item-key.ts"
export { summarizeRun, type ListRunSummariesOptions } from "./run-summary.ts"
export { getProcessRunner, setProcessRunner } from "./process-runner.ts"
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
export type { CliTrustValue } from "@workspace/contracts"
export {
  foldEvents,
  isLiveRunStatus,
  stepTaskStatus,
  type RunState,
} from "./nodes/run-state.ts"
export {
  attemptRootOf,
  frozenDir,
  relOut,
  stepDir,
} from "./nodes/step-paths.ts"
