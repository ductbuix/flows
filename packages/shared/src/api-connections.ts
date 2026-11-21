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

export const connectionsListSchema = z.object({
  connections: z.array(connectionSchema),
})

export type ConnectionsList = z.infer<typeof connectionsListSchema>

export const connectionParamSchema = z.object({
  id: connectionIdSchema,
})

export const connectionCheckResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1),
  ambientLogin: z.string().min(1).optional(),
})

export type ConnectionCheckResult = z.infer<typeof connectionCheckResultSchema>
