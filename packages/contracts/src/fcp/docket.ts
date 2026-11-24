import { z } from "zod"
import {
  assetSchema,
  assetScopeSchema,
  boardSchema,
  cardIdSchema,
  cardLinkRelSchema,
  cardLinkSchema,
  refSchema,
} from "../docket/schemas.ts"
import { defineMethod, defineNotification } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()

export const cursorPageParamsSchema = z.object({
  cursor: cardIdSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
})

export const cardBacklinkSchema = z.object({
  from: cardIdSchema,
  rel: cardLinkRelSchema,
})

export const indexedAssetSchema = assetSchema
  .extend({
    scope: assetScopeSchema,
    missing: z.boolean(),
  })
  .passthrough()

export const indexedLinkSchema = cardLinkSchema
  .extend({
    dangling: z.boolean(),
  })
  .passthrough()

/** Card face on the board (no body; DES-038, DES-040). */
export const cardFaceSchema = z.object({
  id: cardIdSchema,
  path: z.string().min(1),
  hash: z.string(),
  title: z.string(),
  status: z.string(),
  columnId: z.string(),
  rank: z.string(),
  start: z.string().optional(),
  due: z.string().optional(),
  done: z.union([z.string(), z.null()]).optional(),
  refs: z.array(refSchema),
  linkCount: z.number().int().nonnegative(),
  assetCount: z.number().int().nonnegative(),
  missingLinkedAssetCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
})

export type WireCardFace = z.infer<typeof cardFaceSchema>

export const docketGetBoardResultSchema = z.object({
  board: boardSchema.nullable(),
  hash: z.string(),
  warnings: z.array(z.string()),
})

export const docketListCardsResultSchema = z.object({
  items: z.array(cardFaceSchema),
  next: cardIdSchema.optional(),
})

export const docketGetCardResultSchema = cardFaceSchema.extend({
  body: z.string(),
  fields: z.record(z.string(), z.unknown()).optional(),
  assets: z.array(indexedAssetSchema),
  links: z.array(indexedLinkSchema),
  backlinks: z.array(cardBacklinkSchema),
})

export const docketGetBoardMethod = defineMethod({
  name: "docket/get_board",
  params: z.object({}),
  result: docketGetBoardResultSchema,
  kind: "query",
})

export const docketListCardsMethod = defineMethod({
  name: "docket/list_cards",
  params: cursorPageParamsSchema,
  result: docketListCardsResultSchema,
  kind: "query",
})

export const docketGetCardMethod = defineMethod({
  name: "docket/get_card",
  params: z.object({ id: cardIdSchema }),
  result: docketGetCardResultSchema,
  kind: "query",
})

export const docketCardPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    status: z.string().optional(),
    body: z.string().optional(),
    rank: z.string().optional(),
    start: z.union([z.string(), z.null()]).optional(),
    due: z.union([z.string(), z.null()]).optional(),
    done: z.union([z.string(), z.null()]).optional(),
    refs: z.array(refSchema).optional(),
    assets: z.array(assetSchema).optional(),
    links: z.array(cardLinkSchema).optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

export const docketCreateCardParamsSchema = z.object({
  id: cardIdSchema,
  title: z.string().min(1),
  status: z.string().optional(),
  body: z.string().optional(),
  refs: z.array(refSchema).optional(),
  requestKey: fcpRequestKeySchema,
})

export const docketCreateCardResultSchema = z.object({
  hash: z.string(),
  rank: z.string(),
})

export const docketUpdateCardParamsSchema = z.object({
  id: cardIdSchema,
  baseHash: z.string(),
  patch: docketCardPatchSchema,
  requestKey: fcpRequestKeySchema,
})

export const docketUpdateCardResultSchema = z.object({
  hash: z.string(),
})

export const docketDeleteCardParamsSchema = z.object({
  id: cardIdSchema,
  requestKey: fcpRequestKeySchema,
})

export const docketDeleteCardResultSchema = z.object({})

export const docketSaveBoardParamsSchema = z.object({
  baseHash: z.string(),
  board: boardSchema,
  /** Rewrites cards in removed columns to this status (DES-038). */
  migrateStatus: z.string().optional(),
  requestKey: fcpRequestKeySchema,
})

export const docketSaveBoardResultSchema = z.object({
  hash: z.string(),
  migratedCardIds: z.array(cardIdSchema).optional(),
})

export const docketConflictCardSchema = docketGetCardResultSchema

export const docketConflictBoardSchema = docketGetBoardResultSchema

export const docketCreateCardMethod = defineMethod({
  name: "docket/create_card",
  params: docketCreateCardParamsSchema,
  result: docketCreateCardResultSchema,
  kind: "command",
})

export const docketUpdateCardMethod = defineMethod({
  name: "docket/update_card",
  params: docketUpdateCardParamsSchema,
  result: docketUpdateCardResultSchema,
  kind: "command",
})

export const docketDeleteCardMethod = defineMethod({
  name: "docket/delete_card",
  params: docketDeleteCardParamsSchema,
  result: docketDeleteCardResultSchema,
  kind: "command",
})

export const docketSaveBoardMethod = defineMethod({
  name: "docket/save_board",
  params: docketSaveBoardParamsSchema,
  result: docketSaveBoardResultSchema,
  kind: "command",
})

export const docketMoveCardParamsSchema = z.object({
  id: cardIdSchema,
  status: z.string().min(1),
  beforeId: z.union([cardIdSchema, z.null()]).optional(),
  baseHash: z.string(),
  requestKey: fcpRequestKeySchema,
})

export const docketMoveCardResultSchema = z.object({
  hash: z.string(),
  rank: z.string(),
})

export const docketMoveCardMethod = defineMethod({
  name: "docket/move_card",
  params: docketMoveCardParamsSchema,
  result: docketMoveCardResultSchema,
  kind: "command",
})

export const docketUpdateNotification = defineNotification({
  name: "docket/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("card_changed"),
      card: cardFaceSchema,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("card_removed"),
      cardId: cardIdSchema,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("board_changed"),
      hash: z.string(),
      board: boardSchema,
    }),
  ]),
})
