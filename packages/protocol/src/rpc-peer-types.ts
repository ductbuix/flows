import type { RequestContext } from "./cancel.ts"

export type RequestHandler = (
  params: unknown,
  ctx: RequestContext
) => unknown | Promise<unknown>

export type NotificationHandler = (params: unknown) => void | Promise<void>
