import type { FcpMethodDef, FcpNotificationDef } from "./define.ts"
import {
  docketGetBoardMethod,
  docketGetCardMethod,
  docketListCardsMethod,
} from "./docket.ts"
import { subscribeMethod, unsubscribeMethod } from "./subscribe.ts"

/** All FCP request methods; populated as namespaces land (BL-111+). */
export const fcpMethodTable = {
  subscribe: subscribeMethod,
  unsubscribe: unsubscribeMethod,
  "docket/get_board": docketGetBoardMethod,
  "docket/list_cards": docketListCardsMethod,
  "docket/get_card": docketGetCardMethod,
} as const satisfies Record<string, FcpMethodDef>

/** Engine-to-client update notifications (`namespace/update`). */
export const fcpNotificationTable = {} as const satisfies Record<
  string,
  FcpNotificationDef
>
