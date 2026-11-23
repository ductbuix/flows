import type { FcpMethodDef, FcpNotificationDef } from "./define.ts"
import {
  docketCreateCardMethod,
  docketDeleteCardMethod,
  docketGetBoardMethod,
  docketGetCardMethod,
  docketListCardsMethod,
  docketMoveCardMethod,
  docketSaveBoardMethod,
  docketUpdateCardMethod,
  docketUpdateNotification,
} from "./docket.ts"
import { subscribeMethod, unsubscribeMethod } from "./subscribe.ts"

/** All FCP request methods; populated as namespaces land (BL-111+). */
export const fcpMethodTable = {
  subscribe: subscribeMethod,
  unsubscribe: unsubscribeMethod,
  "docket/get_board": docketGetBoardMethod,
  "docket/list_cards": docketListCardsMethod,
  "docket/get_card": docketGetCardMethod,
  "docket/create_card": docketCreateCardMethod,
  "docket/update_card": docketUpdateCardMethod,
  "docket/move_card": docketMoveCardMethod,
  "docket/delete_card": docketDeleteCardMethod,
  "docket/save_board": docketSaveBoardMethod,
} as const satisfies Record<string, FcpMethodDef>

/** Engine-to-client update notifications (`namespace/update`). */
export const fcpNotificationTable = {
  "docket/update": docketUpdateNotification,
} as const satisfies Record<string, FcpNotificationDef>
