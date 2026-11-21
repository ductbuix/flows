import { z } from "zod"

/** Connection id: lowercase slug `[a-z0-9-]` (DES-026). */
export const connectionIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and dashes")

export const signInMethodSchema = z.enum(["cli", "mcp", "cookies"])
export type SignInMethod = z.infer<typeof signInMethodSchema>

export const refreshRuleSchema = z.enum(["15m", "1h", "1d", "never"])
export type RefreshRule = z.infer<typeof refreshRuleSchema>

/** Publish policy; read-only is the default (DES-026 / BL-042). */
export const publishPolicySchema = z.enum(["read-only", "approve-each-publish"])
export type PublishPolicy = z.infer<typeof publishPolicySchema>

export const connectionAccessSchema = z.enum(["read", "propose"])
export type ConnectionAccess = z.infer<typeof connectionAccessSchema>

/** One task `uses` entry (DES-026). */
export const taskUsesEntrySchema = z.object({
  connection: connectionIdSchema,
  access: connectionAccessSchema,
})

export type TaskUsesEntry = z.infer<typeof taskUsesEntrySchema>

export const taskUsesSchema = z.array(taskUsesEntrySchema)

/**
 * Env var for a connection's resources dir: `RESOURCE_` plus the id
 * with every `-` replaced by `_`, uppercased (DES-026).
 */
export function connectionEnvName(connectionId: string): string {
  return `RESOURCE_${connectionId.replaceAll("-", "_").toUpperCase()}`
}

/**
 * `connection.yaml` shape. Strict so secret keys (`token`, `password`,
 * `cookie`) and any other unknown field are rejected (DES-026).
 */
export const connectionSchema = z.strictObject({
  id: connectionIdSchema,
  connector: z.string().min(1),
  name: z.string().min(1),
  scope: z.record(z.string(), z.string()).default({}),
  signIn: signInMethodSchema,
  refresh: refreshRuleSchema,
  policy: publishPolicySchema.default("read-only"),
})

export type Connection = z.infer<typeof connectionSchema>

/** Wire input before defaults (scope, policy) are applied. */
export type ConnectionInput = z.input<typeof connectionSchema>

/** Create / replace body; id comes from the path on PUT. */
export const connectionWriteSchema = connectionSchema

export type ConnectionWrite = ConnectionInput
