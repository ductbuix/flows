import type { ChangeSet } from "@workspace/contracts"
import type { PublishPort, PublishPolicy } from "@workspace/core"
import {
  advanceWorkCopyBase,
  diffWorkCopy,
  getConnector,
  readConnection,
} from "@workspace/adapters-node"

/**
 * PublishPort backed by engine connectors + work-copy (BL-195).
 * `absoluteRunDir` maps the store-relative run dir to a filesystem path.
 */
export function createEnginePublishPort(deps: {
  home: string
  absoluteRunDir: (runDir: string) => string
}): PublishPort {
  return {
    policy(connectionId) {
      const conn = readConnection(deps.home, connectionId)
      if (!conn) return null
      return conn.policy as PublishPolicy
    },
    async diff(input) {
      const runRoot = deps.absoluteRunDir(input.runDir)
      const { changeSet } = await diffWorkCopy({
        home: deps.home,
        runRoot,
        connectionId: input.connectionId,
        publishTaskId: input.nodeId,
        runId: input.runId,
      })
      return changeSet
    },
    async apply(input) {
      const runRoot = deps.absoluteRunDir(input.runDir)
      const conn = readConnection(deps.home, input.connectionId)
      if (!conn) {
        return {
          status: "rejected",
          message: `unknown connection ${input.connectionId}`,
        }
      }
      const connector = getConnector(conn.connector)
      if (!connector) {
        return {
          status: "rejected",
          message: `unknown connector ${conn.connector}`,
        }
      }
      return connector.publish(conn, input.changeSet as ChangeSet, deps.home, {
        runRoot,
      })
    },
    advanceBase(connectionId, runDir) {
      advanceWorkCopyBase(deps.absoluteRunDir(runDir), connectionId)
    },
  }
}
