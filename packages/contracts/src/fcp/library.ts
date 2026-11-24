import { z } from "zod"
import { providerDescriptorSchema, providerIdSchema } from "../provider.ts"
import { defineMethod } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()

export const libraryListProvidersParamsSchema = z.object({
  cursor: providerIdSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
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
