import {
  inboxAnswerMethod,
  inboxDismissMethod,
  inboxListMethod,
} from "@workspace/contracts"
import { defineBinding, type MethodBindings } from "../rpc/bind.ts"
import type { InboxService } from "./service.ts"

export type InboxBindings = Pick<
  MethodBindings,
  "inbox/list" | "inbox/answer" | "inbox/dismiss"
>

export function createInboxBindings(service: InboxService): InboxBindings {
  return {
    "inbox/list": defineBinding(inboxListMethod, (params) =>
      service.list(params)
    ),
    "inbox/answer": defineBinding(inboxAnswerMethod, async (params) => {
      await service.answer(params.itemId, params.optionId)
      return {}
    }),
    "inbox/dismiss": defineBinding(inboxDismissMethod, async (params) => {
      await service.dismiss(params.itemId)
      return {}
    }),
  }
}
