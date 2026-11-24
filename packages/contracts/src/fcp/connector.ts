import { z } from "zod"
import {
  connectorFileIdSchema,
  connectorSchema,
  connectorStatusSchema,
  connectorSummarySchema,
} from "../connector.ts"
import { defineMethod, defineNotification } from "./define.ts"

const fcpRequestKeySchema = z.string().uuid().optional()

export const connectorListParamsSchema = z.object({
  cursor: connectorFileIdSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
})

export const connectorListResultSchema = z.object({
  items: z.array(connectorSummarySchema),
  next: connectorFileIdSchema.optional(),
})

export const connectorGetParamsSchema = z.object({
  id: connectorFileIdSchema,
})

export const connectorGetResultSchema = z.object({
  connector: connectorSchema,
  hash: z.string(),
})

export const connectorSaveParamsSchema = z.object({
  connector: connectorSchema,
  baseHash: z.string().optional(),
  requestKey: fcpRequestKeySchema,
})

export const connectorSaveResultSchema = z.object({
  hash: z.string(),
})

export const connectorRemoveParamsSchema = z.object({
  id: connectorFileIdSchema,
  requestKey: fcpRequestKeySchema,
})

export const connectorRemoveResultSchema = z.object({})

export const connectorSetCapabilityParamsSchema = z.object({
  id: connectorFileIdSchema,
  name: z.string().min(1),
  allowed: z.boolean(),
  baseHash: z.string(),
  requestKey: fcpRequestKeySchema,
})

export const connectorSetCapabilityResultSchema = z.object({
  hash: z.string(),
})

export const connectorListMethod = defineMethod({
  name: "connector/list",
  params: connectorListParamsSchema,
  result: connectorListResultSchema,
  kind: "query",
})

export const connectorGetMethod = defineMethod({
  name: "connector/get",
  params: connectorGetParamsSchema,
  result: connectorGetResultSchema,
  kind: "query",
})

export const connectorSaveMethod = defineMethod({
  name: "connector/save",
  params: connectorSaveParamsSchema,
  result: connectorSaveResultSchema,
  kind: "command",
})

export const connectorRemoveMethod = defineMethod({
  name: "connector/remove",
  params: connectorRemoveParamsSchema,
  result: connectorRemoveResultSchema,
  kind: "command",
})

export const connectorSetCapabilityMethod = defineMethod({
  name: "connector/set_capability",
  params: connectorSetCapabilityParamsSchema,
  result: connectorSetCapabilityResultSchema,
  kind: "command",
})

export const connectorCheckParamsSchema = z.object({
  id: connectorFileIdSchema,
  requestKey: fcpRequestKeySchema,
})

export const connectorCheckResultSchema = z.object({
  status: connectorStatusSchema,
  detail: z.string().min(1).optional(),
})

export const connectorCheckMethod = defineMethod({
  name: "connector/check",
  params: connectorCheckParamsSchema,
  result: connectorCheckResultSchema,
  kind: "command",
})

export const connectorUpdateNotification = defineNotification({
  name: "connector/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("status_changed"),
      connectorId: connectorFileIdSchema,
      status: connectorStatusSchema,
      detail: z.string().min(1).optional(),
      checkedAt: z.string().min(1),
    }),
  ]),
})
