import type { FcpMethodDef, FcpNotificationDef } from "./define.ts"
import { subscribeMethod, unsubscribeMethod } from "./subscribe.ts"

/** All FCP request methods; populated as namespaces land (BL-111+). */
export const fcpMethodTable = {
  subscribe: subscribeMethod,
  unsubscribe: unsubscribeMethod,
} as const satisfies Record<string, FcpMethodDef>

/** Engine-to-client update notifications (`namespace/update`). */
export const fcpNotificationTable = {} as const satisfies Record<
  string,
  FcpNotificationDef
>
