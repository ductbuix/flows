import { z } from "zod"
import { cardIdSchema } from "../docket/schemas.ts"
import { defineMethod } from "./define.ts"
import { indexedAssetSchema } from "./docket.ts"

const fcpRequestKeySchema = z.string().uuid().optional()

export const docketAddOwnedAssetParamsSchema = z.object({
  id: cardIdSchema,
  scope: z.literal("owned"),
  blobId: z.string().min(1),
  /** Basename under the card's `assets/` folder. */
  name: z.string().min(1),
  label: z.string().optional(),
  baseHash: z.string(),
  requestKey: fcpRequestKeySchema,
})

export const docketAddLinkedAssetParamsSchema = z.object({
  id: cardIdSchema,
  scope: z.literal("linked"),
  /** Absolute path; never copied into the card folder. */
  path: z.string().min(1),
  label: z.string().optional(),
  baseHash: z.string(),
  requestKey: fcpRequestKeySchema,
})

export const docketAddAssetParamsSchema = z.discriminatedUnion("scope", [
  docketAddOwnedAssetParamsSchema,
  docketAddLinkedAssetParamsSchema,
])

export const docketAddAssetResultSchema = z.object({
  hash: z.string(),
  asset: indexedAssetSchema,
})

export const docketAddAssetMethod = defineMethod({
  name: "docket/add_asset",
  params: docketAddAssetParamsSchema,
  result: docketAddAssetResultSchema,
  kind: "command",
})

export const docketRemoveAssetParamsSchema = z.object({
  id: cardIdSchema,
  /** Asset `path` entry to drop from the card (file stays on disk). */
  path: z.string().min(1),
  baseHash: z.string(),
  requestKey: fcpRequestKeySchema,
})

export const docketRemoveAssetResultSchema = z.object({
  hash: z.string(),
})

export const docketRemoveAssetMethod = defineMethod({
  name: "docket/remove_asset",
  params: docketRemoveAssetParamsSchema,
  result: docketRemoveAssetResultSchema,
  kind: "command",
})
