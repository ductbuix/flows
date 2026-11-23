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
import { defineMethod } from "./define.ts"

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
