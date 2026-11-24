import { z } from "zod"
import { signInMethodSchema } from "./publish.ts"

/** Built-in connector adapter description (engine registry / DES-026). */
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

/** Result of a connector connectivity check. */
export const connectionCheckResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().min(1),
  ambientLogin: z.string().min(1).optional(),
})

export type ConnectionCheckResult = z.infer<typeof connectionCheckResultSchema>
