import { z } from "zod"
import { workItemIdSchema } from "../work-item.ts"

/** Card folder slug (same rule as work item ids, DES-038). */
export const cardIdSchema = workItemIdSchema

/** Card-to-card link relation (DES-038). */
export const cardLinkRelSchema = z.enum([
  "relates",
  "blocks",
  "parent",
  "duplicates",
])

/** Pointer to an item in another system (DES-038). */
export const refSchema = z
  .object({
    system: z.string().min(1),
    kind: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    label: z.string().optional(),
    syncedAt: z.string().optional(),
    snapshot: z.string().optional(),
  })
  .strict()

export type DocketRef = z.infer<typeof refSchema>

export const assetScopeSchema = z.enum(["owned", "linked"])

/** Owned or linked file on a card (DES-038). */
export const assetSchema = z
  .object({
    path: z.string().min(1),
    label: z.string().optional(),
    scope: assetScopeSchema.optional(),
  })
  .strict()

export type DocketAsset = z.infer<typeof assetSchema>

/** Stored on one side; backlinks come from the index (DES-038). */
export const cardLinkSchema = z
  .object({
    to: cardIdSchema,
    rel: cardLinkRelSchema,
  })
  .strict()

export type CardLink = z.infer<typeof cardLinkSchema>

/**
 * card.md frontmatter (DES-038). Required keys only; unknown top-level keys
 * pass through.
 */
export const cardSchema = z
  .object({
    id: cardIdSchema,
    title: z.string().min(1),
    status: z.string(),
    created: z.string(),
    updated: z.string(),
    rank: z.string().optional(),
    start: z.string().optional(),
    due: z.string().optional(),
    done: z.union([z.string(), z.null()]).optional(),
    refs: z.array(refSchema).optional(),
    assets: z.array(assetSchema).optional(),
    links: z.array(cardLinkSchema).optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export type Card = z.infer<typeof cardSchema>

export const boardColumnSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    done: z.boolean().optional(),
  })
  .strict()

export type BoardColumn = z.infer<typeof boardColumnSchema>

/** board.yaml (DES-038). */
export const boardSchema = z
  .object({
    version: z.literal(1),
    columns: z.array(boardColumnSchema).min(1),
    face: z.array(z.string().min(1)).max(2),
  })
  .strict()

export type Board = z.infer<typeof boardSchema>
