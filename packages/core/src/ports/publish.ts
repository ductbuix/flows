import type { ChangeSet } from "@workspace/contracts"

/** Outcome of a connector publish call (DES-026). */
export type PublishResult =
  | {
      status: "applied"
      result: Record<string, unknown>
      undoNote: string
    }
  | { status: "conflict"; message: string }
  | { status: "rejected"; message: string }

/** Connection publish policy (subset used by the output publish step). */
export type PublishPolicy =
  "read-only" | "approve-each-publish" | "trust-agent-review"

/**
 * Connector + work-copy port for output `target: publish` (BL-195).
 * Host wraps engine connectors / work-copy; tests use a fake.
 */
export type PublishPort = {
  /** Null when the connection id is unknown. */
  policy(connectionId: string): PublishPolicy | null
  /** Diff the run work copy against the last published base. */
  diff(input: {
    connectionId: string
    runDir: string
    nodeId: string
    runId: string
  }): Promise<ChangeSet>
  /** Send the change set through the connector. */
  apply(input: {
    connectionId: string
    changeSet: ChangeSet
    runDir: string
  }): Promise<PublishResult>
  /** After an applied publish, advance the work-copy base. */
  advanceBase?(connectionId: string, runDir: string): void
}
