import type { Context } from "hono"
import type { IdempotencyStore } from "./idempotency.ts"

export function errorJson(
  c: Context,
  status: 400 | 404 | 409,
  error: string,
  message: string
) {
  return c.json({ error, message }, status)
}

export function mapEngineError(c: Context, err: unknown) {
  const message = err instanceof Error ? err.message : "request failed"
  if (
    /not awaiting approval|cannot be retried|cannot delete live|not live|unknown run/.test(
      message
    )
  ) {
    return errorJson(c, 409, "conflict", message)
  }
  return errorJson(c, 400, "bad_request", message)
}

/** Return a cached response or run `fn` and store the 200 body. */
export async function withIdempotency(
  c: Context,
  store: IdempotencyStore,
  requestId: string,
  fn: () => Promise<Response> | Response
): Promise<Response> {
  const cached = store.get(requestId)
  if (cached) return c.json(cached.body, cached.status as 200)
  const res = await fn()
  if (res.status === 200) {
    const body = await res.clone().json()
    store.set(requestId, 200, body)
  }
  return res
}
