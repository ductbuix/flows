import { z } from "zod"
import { LibItemId } from "../ids.ts"
import { libItemSchema, libTagSchema, libVersionSchema } from "../lib-item.ts"
import {
  providerDescriptorSchema,
  providerIconSchema,
  providerIdSchema,
} from "../provider.ts"
import { defineMethod, defineNotification } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()
const DEFAULT_LIMIT_MAX = 500

export const libraryListProvidersParamsSchema = z.object({
  cursor: providerIdSchema.optional(),
  limit: z.number().int().positive().max(DEFAULT_LIMIT_MAX).optional(),
})

export const libraryListProvidersResultSchema = z.object({
  items: z.array(providerDescriptorSchema),
  next: providerIdSchema.optional(),
})

export const librarySaveProviderParamsSchema = z.object({
  provider: providerDescriptorSchema,
  requestKey: fcpRequestKeySchema,
})

export const librarySaveProviderResultSchema = z.object({})

export const libraryListProvidersMethod = defineMethod({
  name: "library/list_providers",
  params: libraryListProvidersParamsSchema,
  result: libraryListProvidersResultSchema,
  kind: "query",
})

export const librarySaveProviderMethod = defineMethod({
  name: "library/save_provider",
  params: librarySaveProviderParamsSchema,
  result: librarySaveProviderResultSchema,
  kind: "command",
})

export const libraryListParamsSchema = z.object({
  cursor: LibItemId.optional(),
  limit: z.number().int().positive().max(DEFAULT_LIMIT_MAX).optional(),
  /** When set, only items that carry this exact `namespace:value` tag. */
  tag: libTagSchema.optional(),
})

export const libraryListResultSchema = z.object({
  items: z.array(libItemSchema),
  next: LibItemId.optional(),
})

export const libraryGetParamsSchema = z.object({
  id: LibItemId,
})

export const libraryGetResultSchema = libItemSchema

export const libraryPullParamsSchema = z.object({
  id: LibItemId,
  requestKey: fcpRequestKeySchema,
})

/** FCP pull returns a job id; distinct from legacy REST `libraryPullResultSchema`. */
export const libraryPullJobResultSchema = z.object({
  jobId: z.string().min(1),
})

export const libraryPinVersionParamsSchema = z.object({
  id: LibItemId,
  n: z.number().int().positive(),
  requestKey: fcpRequestKeySchema,
})

export const libraryPinVersionResultSchema = libItemSchema

export const librarySetTagsParamsSchema = z.object({
  id: LibItemId,
  tags: z.array(libTagSchema),
  requestKey: fcpRequestKeySchema,
})

export const librarySetTagsResultSchema = libItemSchema

export const libraryRemoveParamsSchema = z.object({
  id: LibItemId,
  requestKey: fcpRequestKeySchema,
})

export const libraryRemoveResultSchema = z.object({})

export const libraryAddRemoteParamsSchema = z.object({
  kind: z.literal("remote"),
  url: z.string().min(1),
  requestKey: fcpRequestKeySchema,
})

export const libraryAddLocalParamsSchema = z.object({
  kind: z.literal("local"),
  title: z.string().min(1),
  itemKind: providerIconSchema.default("other"),
  tags: z.array(libTagSchema).default([]),
  /** Relative path → UTF-8 text for version 1. */
  files: z.record(z.string(), z.string()).default({}),
  requestKey: fcpRequestKeySchema,
})

export const libraryAddParamsSchema = z.discriminatedUnion("kind", [
  libraryAddRemoteParamsSchema,
  libraryAddLocalParamsSchema,
])

export const libraryAddResultSchema = libItemSchema

export const libraryPushParamsSchema = z.object({
  id: LibItemId,
  requestKey: fcpRequestKeySchema,
})

export const libraryPushResultSchema = libraryPullJobResultSchema

export const libraryUnlinkParamsSchema = z.object({
  id: LibItemId,
  requestKey: fcpRequestKeySchema,
})

export const libraryUnlinkResultSchema = libItemSchema

export const libraryListMethod = defineMethod({
  name: "library/list",
  params: libraryListParamsSchema,
  result: libraryListResultSchema,
  kind: "query",
})

export const libraryGetMethod = defineMethod({
  name: "library/get",
  params: libraryGetParamsSchema,
  result: libraryGetResultSchema,
  kind: "query",
})

export const libraryPullMethod = defineMethod({
  name: "library/pull",
  params: libraryPullParamsSchema,
  result: libraryPullJobResultSchema,
  kind: "command",
})

export const libraryPushMethod = defineMethod({
  name: "library/push",
  params: libraryPushParamsSchema,
  result: libraryPushResultSchema,
  kind: "command",
})

export const libraryAddMethod = defineMethod({
  name: "library/add",
  params: libraryAddParamsSchema,
  result: libraryAddResultSchema,
  kind: "command",
})

export const libraryUnlinkMethod = defineMethod({
  name: "library/unlink",
  params: libraryUnlinkParamsSchema,
  result: libraryUnlinkResultSchema,
  kind: "command",
})

export const libraryPinVersionMethod = defineMethod({
  name: "library/pin_version",
  params: libraryPinVersionParamsSchema,
  result: libraryPinVersionResultSchema,
  kind: "command",
})

export const librarySetTagsMethod = defineMethod({
  name: "library/set_tags",
  params: librarySetTagsParamsSchema,
  result: librarySetTagsResultSchema,
  kind: "command",
})

export const libraryRemoveMethod = defineMethod({
  name: "library/remove",
  params: libraryRemoveParamsSchema,
  result: libraryRemoveResultSchema,
  kind: "command",
})

export const libraryUpdateNotification = defineNotification({
  name: "library/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("item_changed"),
      item: libItemSchema,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("item_removed"),
      id: LibItemId,
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("job_progress"),
      jobId: z.string().min(1),
      itemId: LibItemId,
      message: z.string().optional(),
      fraction: z.number().min(0).max(1).optional(),
    }),
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("job_finished"),
      jobId: z.string().min(1),
      itemId: LibItemId,
      ok: z.boolean(),
      unchanged: z.boolean().optional(),
      version: libVersionSchema.optional(),
      error: z.string().optional(),
    }),
  ]),
})
