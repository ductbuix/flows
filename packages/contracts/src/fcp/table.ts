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
import {
  fileListMethod,
  fileReadTextMethod,
  fileRevealMethod,
  fileStatMethod,
  fileWriteTextMethod,
} from "./file.ts"
import { initializeMethod } from "./initialize.ts"
import {
  libraryListProvidersMethod,
  librarySaveProviderMethod,
} from "./library.ts"
import { pingMethod } from "./ping.ts"
import {
  runCancelMethod,
  runDeleteMethod,
  runGetChangesMethod,
  runGetLogMethod,
  runGetMethod,
  runListMethod,
  runRerunMethod,
  runRetryStepMethod,
  runStartMethod,
  runUpdateNotification,
} from "./run.ts"
import {
  skillGetMethod,
  skillListMethod,
  skillUpdateNotification,
} from "./skill.ts"
import { subscribeMethod, unsubscribeMethod } from "./subscribe.ts"
import {
  workflowCreateMethod,
  workflowDeleteMethod,
  workflowGetMethod,
  workflowListMethod,
  workflowRenameMethod,
  workflowSaveLayoutMethod,
  workflowSaveMethod,
  workflowUpdateNotification,
  workflowValidateMethod,
} from "./workflow.ts"

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
  "workflow/create": workflowCreateMethod,
  "workflow/save": workflowSaveMethod,
  "workflow/rename": workflowRenameMethod,
  "workflow/delete": workflowDeleteMethod,
  "workflow/save_layout": workflowSaveLayoutMethod,
  "workflow/validate": workflowValidateMethod,
  "run/list": runListMethod,
  "run/get": runGetMethod,
  "run/start": runStartMethod,
  "run/cancel": runCancelMethod,
  "run/rerun": runRerunMethod,
  "run/retry_step": runRetryStepMethod,
  "run/delete": runDeleteMethod,
  "run/get_log": runGetLogMethod,
  "run/get_changes": runGetChangesMethod,
  "skill/list": skillListMethod,
  "skill/get": skillGetMethod,
  "file/list": fileListMethod,
  "file/stat": fileStatMethod,
  "file/read_text": fileReadTextMethod,
  "file/write_text": fileWriteTextMethod,
  "file/reveal": fileRevealMethod,
} as const satisfies Record<string, FcpMethodDef>

/** Engine-to-client update notifications (`namespace/update`). */
export const fcpNotificationTable = {
  "docket/update": docketUpdateNotification,
  "workflow/update": workflowUpdateNotification,
  "run/update": runUpdateNotification,
  "skill/update": skillUpdateNotification,
} as const satisfies Record<string, FcpNotificationDef>
