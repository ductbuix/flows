import { z } from "zod"
import {
  connectionIdSchema,
  connectionSchema,
  signInMethodSchema,
} from "./connection.ts"

export const connectorDescribeSchema = z.object({
  id: z.string().min(1),
  entityKinds: z.array(z.string().min(1)),
  scopeFields: z.array(z.string().min(1)),
  signInMethods: z.array(signInMethodSchema).min(1),
})

export type ConnectorDescribe = z.infer<typeof connectorDescribeSchema>

export const connectorsListSchema = z.object({
  connectors: z.array(connectorDescribeSchema),
})

export type ConnectorsList = z.infer<typeof connectorsListSchema>

/** List row: connection plus workflow ids that `uses` it (BL-045). */
export const connectionListItemSchema = connectionSchema.extend({
  usedBy: z.array(z.string().min(1)),
})

export type ConnectionListItem = z.infer<typeof connectionListItemSchema>

export const connectionsListSchema = z.object({
  connections: z.array(connectionListItemSchema),
})

export type ConnectionsList = z.infer<typeof connectionsListSchema>

/** Detail: connection plus workflows and runs that pin or use it (BL-045). */
export const connectionDetailSchema = connectionSchema.extend({
  usedByWorkflows: z.array(z.string().min(1)),
  usedByRuns: z.array(z.string().min(1)),
})

export type ConnectionDetail = z.infer<typeof connectionDetailSchema>

export const connectionParamSchema = z.object({
  id: connectionIdSchema,
})

export const connectionCheckResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1),
  ambientLogin: z.string().min(1).optional(),
})

export type ConnectionCheckResult = z.infer<typeof connectionCheckResultSchema>
