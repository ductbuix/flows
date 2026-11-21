import type {
  Connection,
  ConnectionCheckResult,
  ConnectorDescribe,
} from "@workspace/shared"

export type ConnectorPullInput = {
  connection: Connection
  entityKind: string
  entityId: string
  /** Absolute path of the revision folder to write into. */
  destDir: string
  home: string
}

export type ConnectorDiffInput = {
  connection: Connection
  workCopyDir: string
  baseDir: string
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
  | { status: "applied"; result: Record<string, unknown> }
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
  pull: (input: ConnectorPullInput) => Promise<void>
  diff: (input: ConnectorDiffInput) => Promise<ConnectorChangeSet>
  publish: (
    connection: Connection,
    changeSet: ConnectorChangeSet,
    home: string
  ) => Promise<ConnectorPublishResult>
}
