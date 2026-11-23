import type { FcpMethodDef, FcpNotificationDef } from "./define.ts"
import {
  connectorGetMethod,
  connectorListMethod,
  connectorRemoveMethod,
  connectorSaveMethod,
  connectorSetCapabilityMethod,
} from "./connector.ts"
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
import { initializeMethod } from "./initialize.ts"
import {
  libraryListProvidersMethod,
  librarySaveProviderMethod,
} from "./library.ts"
import { pingMethod } from "./ping.ts"
import { runGetMethod, runListMethod, runUpdateNotification } from "./run.ts"
import {
  skillGetMethod,
  skillListMethod,
  skillUpdateNotification,
} from "./skill.ts"
import { subscribeMethod, unsubscribeMethod } from "./subscribe.ts"
import { workflowGetMethod, workflowListMethod } from "./workflow.ts"

/** All FCP request methods; populated as namespaces land (BL-111+). */
export const fcpMethodTable = {
  initialize: initializeMethod,
  ping: pingMethod,
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
  "connector/list": connectorListMethod,
  "connector/get": connectorGetMethod,
  "connector/save": connectorSaveMethod,
  "connector/remove": connectorRemoveMethod,
  "connector/set_capability": connectorSetCapabilityMethod,
  "library/list_providers": libraryListProvidersMethod,
  "library/save_provider": librarySaveProviderMethod,
  "workflow/list": workflowListMethod,
  "workflow/get": workflowGetMethod,
  "run/list": runListMethod,
  "run/get": runGetMethod,
  "skill/list": skillListMethod,
  "skill/get": skillGetMethod,
} as const satisfies Record<string, FcpMethodDef>

/** Engine-to-client update notifications (`namespace/update`). */
export const fcpNotificationTable = {
  "docket/update": docketUpdateNotification,
  "run/update": runUpdateNotification,
  "skill/update": skillUpdateNotification,
} as const satisfies Record<string, FcpNotificationDef>
