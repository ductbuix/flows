import { createRallyRequest, errorsOf, RallyHttpError } from "./http.ts"
import {
  pathForKind,
  typeNameForKind,
  type RallyClientOptions,
  type RallyJson,
} from "./types.ts"

export type { RallyClientOptions, RallyFetch, RallyJson } from "./types.ts"
export {
  cookieHeader,
  pathForKind,
  rallyBaseUrl,
  typeNameForKind,
} from "./types.ts"
export { RallyHttpError }

/** Cookie-authenticated Rally WSAPI client (DES-026 / BL-055). */
export function createRallyClient(options: RallyClientOptions) {
  const request = createRallyRequest(
    options.baseUrl,
    options.cookies,
    options.fetchFn
  )

  return {
    async getUser(): Promise<{ ok: true } | { ok: false; message: string }> {
      const { status, body } = await request("/slm/webservice/v2.0/user")
      if (status === 401 || status === 403) {
        return { ok: false, message: "cookies expired" }
      }
      if (status >= 400) {
        return { ok: false, message: `rally check failed (${status})` }
      }
      const errs = errorsOf(body)
      if (errs.length > 0) {
        const msg = errs.join("; ")
        if (/not authorized|invalid key|session/i.test(msg)) {
          return { ok: false, message: "cookies expired" }
        }
        return { ok: false, message: msg }
      }
      if (!body.User || typeof body.User !== "object") {
        return { ok: false, message: "cookies expired" }
      }
      return { ok: true }
    },

    async getArtifact(
      kind: string,
      entityId: string
    ): Promise<{ object: RallyJson; revision: string }> {
      const typeName = typeNameForKind(kind)
      const pathKind = pathForKind(kind)
      let { status, body } = await request(
        `/slm/webservice/v2.0/${pathKind}/${encodeURIComponent(entityId)}`
      )
      if (status === 404 || errorsOf(body).length > 0) {
        const q = encodeURIComponent(`(FormattedID = ${entityId})`)
        const query = await request(
          `/slm/webservice/v2.0/${pathKind}?query=${q}&pagesize=1&fetch=true`
        )
        status = query.status
        body = query.body
        const results = (body.QueryResult as RallyJson | undefined)?.Results
        if (!Array.isArray(results) || results.length === 0) {
          throw new RallyHttpError(
            `rally ${kind} ${entityId} not found`,
            status === 200 ? 404 : status
          )
        }
        return artifactResult(typeName, results[0] as RallyJson)
      }
      if (status === 401 || status === 403) {
        throw new RallyHttpError("cookies expired", status)
      }
      if (status >= 400) {
        throw new RallyHttpError(
          errorsOf(body).join("; ") || `rally pull failed (${status})`,
          status
        )
      }
      const object = body[typeName]
      if (!object || typeof object !== "object") {
        throw new RallyHttpError(`rally ${kind} missing body`, status)
      }
      return artifactResult(typeName, object as RallyJson)
    },

    async securityToken(): Promise<string> {
      const { status, body } = await request(
        "/slm/webservice/v2.0/security/authorize"
      )
      if (status === 401 || status === 403) {
        throw new RallyHttpError("cookies expired", status)
      }
      const result = body.OperationResult as RallyJson | undefined
      const token = result?.SecurityToken
      if (typeof token !== "string" || token.length === 0) {
        throw new RallyHttpError(
          errorsOf(body).join("; ") || "rally security token missing",
          status
        )
      }
      return token
    },

    async putArtifact(
      kind: string,
      objectId: string,
      fields: RallyJson,
      token: string
    ): Promise<void> {
      const typeName = typeNameForKind(kind)
      const pathKind = pathForKind(kind)
      const key = encodeURIComponent(token)
      const { status, body } = await request(
        `/slm/webservice/v2.0/${pathKind}/${encodeURIComponent(objectId)}?key=${key}`,
        {
          method: "PUT",
          body: JSON.stringify({ [typeName]: fields }),
        }
      )
      if (status === 401 || status === 403) {
        throw new RallyHttpError("cookies expired", status)
      }
      const errs = errorsOf(body)
      if (status >= 400 || errs.length > 0) {
        throw new RallyHttpError(
          errs.join("; ") || `rally update failed (${status})`,
          status
        )
      }
    },

    async postComment(
      artifactRef: string,
      text: string,
      token: string
    ): Promise<void> {
      const key = encodeURIComponent(token)
      const { status, body } = await request(
        `/slm/webservice/v2.0/conversationpost/create?key=${key}`,
        {
          method: "POST",
          body: JSON.stringify({
            ConversationPost: { Text: text, Artifact: artifactRef },
          }),
        }
      )
      if (status === 401 || status === 403) {
        throw new RallyHttpError("cookies expired", status)
      }
      const errs = errorsOf(body)
      if (status >= 400 || errs.length > 0) {
        throw new RallyHttpError(
          errs.join("; ") || `rally comment failed (${status})`,
          status
        )
      }
    },
  }
}

function artifactResult(
  typeName: string,
  object: RallyJson
): { object: RallyJson; revision: string } {
  const oid = object.ObjectID
  const version = object._objectVersion ?? object.VersionId ?? oid
  const revision =
    typeof version === "string" || typeof version === "number"
      ? String(version)
      : typeof oid === "string" || typeof oid === "number"
        ? String(oid)
        : "unknown"
  return { object: { ...object, _typeName: typeName }, revision }
}

export type RallyClient = ReturnType<typeof createRallyClient>
