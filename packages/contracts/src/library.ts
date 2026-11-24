import { z } from "zod"
import { connectionIdSchema } from "./ids.ts"
import { refreshRuleSchema } from "./publish.ts"

/** One pinned library entity revision on a run (DES-026). */
export const resourcePinSchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
  revision: z.string().min(1),
  title: z.string().min(1),
})

export type ResourcePin = z.infer<typeof resourcePinSchema>

/** Frozen pins written before run_started (DES-026 / BL-043). */
export const resourcesJsonSchema = z.object({
  v: z.literal(1),
  pins: z.array(resourcePinSchema),
  warnings: z.array(z.string().min(1)).default([]),
})

export type ResourcesJson = z.infer<typeof resourcesJsonSchema>

/** resources/index.json entry (same fields as a pin). */
export const resourcesIndexSchema = z.object({
  v: z.literal(1),
  entries: z.array(resourcePinSchema),
})

export type ResourcesIndex = z.infer<typeof resourcesIndexSchema>

export const libraryPullBodySchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
})

export type LibraryPullBody = z.infer<typeof libraryPullBodySchema>

export const libraryRevisionSchema = z.object({
  revision: z.string().min(1),
  pulledAt: z.string().min(1),
  title: z.string().min(1),
  current: z.boolean(),
  pinningRunIds: z.array(z.string().min(1)),
})

export type LibraryRevision = z.infer<typeof libraryRevisionSchema>

export const libraryEntitySchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string().min(1),
  refresh: refreshRuleSchema,
  pulledAt: z.string().min(1).optional(),
  fresh: z.boolean(),
  revisions: z.array(libraryRevisionSchema),
})

export type LibraryEntity = z.infer<typeof libraryEntitySchema>

/** Disk usage vs config cap (DES-026 / BL-047). */
export const libraryUsageSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  maxBytes: z.number().int().positive(),
})

export type LibraryUsage = z.infer<typeof libraryUsageSchema>

/** Warn when usedBytes / maxBytes reaches this ratio. */
export const LIBRARY_USAGE_WARN_RATIO = 0.8

export const libraryListSchema = z.object({
  entities: z.array(libraryEntitySchema),
  usage: libraryUsageSchema,
})

export type LibraryList = z.infer<typeof libraryListSchema>

export const libraryPullResultSchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
  revision: z.string().min(1),
  title: z.string().min(1),
  pulledAt: z.string().min(1),
})

export type LibraryPullResult = z.infer<typeof libraryPullResultSchema>

export const libraryClearBodySchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
})

export type LibraryClearBody = z.infer<typeof libraryClearBodySchema>

export const libraryClearResultSchema = z.object({
  connection: connectionIdSchema,
  kind: z.string().min(1),
  entityId: z.string().min(1),
  removed: z.array(z.string().min(1)),
})

export type LibraryClearResult = z.infer<typeof libraryClearResultSchema>
