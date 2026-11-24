import type { ConnectionCheckResult } from "@workspace/contracts"
import type { Connection } from "../../connection-model.ts"
import { isSignedIn, readCookies } from "../../secrets.ts"
import type {
  Connector,
  ConnectorChangeSet,
  ConnectorPublishResult,
  ConnectorPullResult,
} from "../types.ts"
import {
  createRallyClient,
  RallyHttpError,
  rallyBaseUrl,
  type RallyFetch,
} from "./client.ts"
import { diffRallyDirs, writePulledItem } from "./files.ts"

export type RallyConnectorDeps = {
  fetchFn?: RallyFetch
}

function requireCookies(home: string, connectionId: string) {
  const cookies = readCookies(home, connectionId)
  if (!cookies || cookies.length === 0) {
    throw new Error("not signed in")
  }
  return cookies
}

function clientFor(connection: Connection, home: string, fetchFn?: RallyFetch) {
  return createRallyClient({
    baseUrl: rallyBaseUrl(connection.scope),
    cookies: requireCookies(home, connection.id),
    fetchFn,
  })
}

/** Build a Rally connector; tests inject fetch (DES-026 / BL-055). */
export function createRallyConnector(deps: RallyConnectorDeps = {}): Connector {
  const { fetchFn } = deps
  return {
    id: "rally",
    describe() {
      return {
        id: "rally",
        entityKinds: ["story", "defect"],
        scopeFields: ["workspace", "project", "url", "domain"],
        signInMethods: ["cookies"],
      }
    },
    async check(connection, home): Promise<ConnectionCheckResult> {
      if (connection.signIn !== "cookies") {
        return {
          ok: false,
          message: `rally requires cookies sign-in, got ${connection.signIn}`,
        }
      }
      if (!isSignedIn(home, connection.id)) {
        return { ok: false, message: "not signed in" }
      }
      try {
        const result = await clientFor(connection, home, fetchFn).getUser()
        if (!result.ok) return { ok: false, message: result.message }
        return { ok: true, message: "rally sign-in ok" }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "rally check failed"
        return { ok: false, message }
      }
    },
    async pull(input): Promise<ConnectorPullResult> {
      if (input.entityKind !== "story" && input.entityKind !== "defect") {
        throw new Error(
          `rally connector only pulls story or defect, got ${input.entityKind}`
        )
      }
      const client = clientFor(input.connection, input.home, fetchFn)
      const { object, revision } = await client.getArtifact(
        input.entityKind,
        input.entityId
      )
      writePulledItem(input.destDir, object)
      return { revision }
    },
    async diff(input): Promise<ConnectorChangeSet> {
      return diffRallyDirs(
        input.connection.id,
        input.workCopyDir,
        input.baseDir
      )
    },
    async publish(
      connection,
      changeSet,
      home
    ): Promise<ConnectorPublishResult> {
      if (changeSet.ops.length === 0) {
        return {
          status: "applied",
          result: { ops: 0 },
          undoNote: "No Rally changes were published.",
        }
      }
      try {
        const client = clientFor(connection, home, fetchFn)
        const token = await client.securityToken()
        const fieldUpdates: Record<string, string> = {}
        let objectId: string | undefined
        let entityKind: string | undefined
        let artifactRef: string | undefined
        let comments = 0

        for (const op of changeSet.ops) {
          const payload = op.payload as Record<string, unknown>
          if (typeof payload.objectId === "string") objectId = payload.objectId
          if (typeof payload.entityKind === "string") {
            entityKind = payload.entityKind
          }
          if (typeof payload.artifactRef === "string") {
            artifactRef = payload.artifactRef
          }
          if (op.op === "field" && typeof payload.after === "string") {
            const field =
              typeof payload.field === "string" ? payload.field : op.target
            fieldUpdates[field] = payload.after
          } else if (
            op.op === "comment" &&
            typeof payload.text === "string" &&
            payload.text.trim()
          ) {
            const ref =
              artifactRef ??
              (objectId && entityKind
                ? `/${entityKind === "defect" ? "defect" : "hierarchicalrequirement"}/${objectId}`
                : undefined)
            if (!ref) {
              return {
                status: "rejected",
                message: "rally comment missing artifact ref",
              }
            }
            await client.postComment(ref, payload.text.trim(), token)
            comments += 1
          }
        }

        if (Object.keys(fieldUpdates).length > 0) {
          if (!objectId || !entityKind) {
            return {
              status: "rejected",
              message: "rally field update missing object id",
            }
          }
          await client.putArtifact(entityKind, objectId, fieldUpdates, token)
        }

        return {
          status: "applied",
          result: {
            objectId: objectId ?? null,
            fields: Object.keys(fieldUpdates),
            comments,
          },
          undoNote:
            "Revert the Rally field changes and delete the conversation posts in Rally.",
        }
      } catch (err) {
        if (
          err instanceof RallyHttpError &&
          err.message === "cookies expired"
        ) {
          return { status: "rejected", message: "cookies expired" }
        }
        const message =
          err instanceof Error ? err.message : "rally publish failed"
        if (/conflict|has been modified|concurrent/i.test(message)) {
          return { status: "conflict", message }
        }
        return { status: "rejected", message }
      }
    },
  }
}

export const rallyConnector = createRallyConnector()
