import type { PendingClientRequest } from "./cancel.ts"

export type ClientRequestScope = {
  readonly sessionId: string
  readonly pending: Set<PendingClientRequest>
}

/**
 * Answer an agent-initiated client request. Requests for another session
 * are rejected; otherwise the request parks until the handler settles or
 * `session/cancel` answers it with `cancelledResult`.
 */
export function handleClientRequest(
  scope: ClientRequestScope,
  params: unknown,
  handler: ((params: unknown) => Promise<unknown>) | undefined,
  cancelledResult: unknown,
  method: string
): Promise<unknown> {
  if (
    params &&
    typeof params === "object" &&
    "sessionId" in params &&
    (params as { sessionId: unknown }).sessionId !== scope.sessionId
  ) {
    return Promise.reject(new Error(`${method} wrong session`))
  }
  return new Promise((resolve, reject) => {
    const entry: PendingClientRequest = {
      resolve,
      cancelledResult,
    }
    scope.pending.add(entry)
    if (!handler) return
    void handler(params).then(
      (result) => {
        if (!scope.pending.has(entry)) return
        scope.pending.delete(entry)
        resolve(result)
      },
      (err: unknown) => {
        if (!scope.pending.has(entry)) return
        scope.pending.delete(entry)
        reject(err)
      }
    )
  })
}
