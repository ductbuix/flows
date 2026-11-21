import type {
  Connection,
  ConnectionCheckResult,
  ConnectorDescribe,
} from "@workspace/shared"

export type ConnectorPullInput = {
  connection: Connection
  entityKind: string
  entityId: string
  /** Absolute path of the entity root (shared clone may live here). */
  entityRoot: string
  /** Absolute path of the staging folder to write the revision into. */
  destDir: string
  home: string
}

/** Optional revision id from pull (e.g. git commit sha). */
export type ConnectorPullResult = {
  revision?: string
}

export type ConnectorDiffInput = {
  connection: Connection
  workCopyDir: string
  baseDir: string
  /** Run id for branch names like `flows/<runId>/<publishTaskId>` (BL-050). */
  runId?: string
  publishTaskId?: string
}

/** Optional paths so publish can push from the run's work copy (BL-050). */
export type ConnectorPublishContext = {
  runRoot?: string
  workCopyDir?: string
}

export type ConnectorChangeSet = {
  v: 1
  connection: string
  base: string
  ops: Array<{
    op: string
    target: string
    summary: string
    destructive: boolean
    payload: unknown
  }>
}

export type ConnectorPublishResult =
  | {
      status: "applied"
      result: Record<string, unknown>
      /** How to undo this Cloud effect (DES-026 / BL-049). */
      undoNote: string
    }
  | { status: "conflict"; message: string }
  | { status: "rejected"; message: string }

/**
 * In-repo connector adapter (DES-026). Same strategy pattern as
 * CliAdapter: one module per source, registered by id.
 */
export type Connector = {
  id: string
  describe: () => ConnectorDescribe
  check: (
    connection: Connection,
    home: string
  ) => Promise<ConnectionCheckResult>
  pull: (input: ConnectorPullInput) => Promise<ConnectorPullResult | void>
  diff: (input: ConnectorDiffInput) => Promise<ConnectorChangeSet>
  publish: (
    connection: Connection,
    changeSet: ConnectorChangeSet,
    home: string,
    context?: ConnectorPublishContext
  ) => Promise<ConnectorPublishResult>
}
