import { z } from "zod"
import { slugIdSchema } from "./ids.ts"

/** Publish policy for a connector-backed target (DES-026 / BL-042 / BL-052). */
export const publishPolicySchema = z.enum([
  "read-only",
  "approve-each-publish",
  "trust-agent-review",
])
export type PublishPolicy = z.infer<typeof publishPolicySchema>

export const refreshRuleSchema = z.enum(["15m", "1h", "1d", "never"])
export type RefreshRule = z.infer<typeof refreshRuleSchema>

export const signInMethodSchema = z.enum(["cli", "mcp", "cookies"])
export type SignInMethod = z.infer<typeof signInMethodSchema>

export const connectionAccessSchema = z.enum(["read", "propose"])
export type ConnectionAccess = z.infer<typeof connectionAccessSchema>

/** One task `uses` entry (DES-026). Kept for node workflow parse. */
export const taskUsesEntrySchema = z.object({
  connection: slugIdSchema,
  access: connectionAccessSchema,
})

export type TaskUsesEntry = z.infer<typeof taskUsesEntrySchema>

export const taskUsesSchema = z.array(taskUsesEntrySchema)

/**
 * Env var for a connection-scoped resources dir: `RESOURCE_` plus the id
 * with every `-` replaced by `_`, uppercased (DES-026).
 */
export function connectionEnvName(connectionId: string): string {
  return `RESOURCE_${connectionId.replaceAll("-", "_").toUpperCase()}`
}

/** One op in a change set envelope (DES-026). */
export const changeSetOpSchema = z.object({
  op: z.string().min(1),
  target: z.string().min(1),
  summary: z.string().min(1),
  destructive: z.boolean(),
  payload: z.unknown(),
})

export type ChangeSetOp = z.infer<typeof changeSetOpSchema>

/** Connector change set envelope (DES-026 / BL-048). */
export const changeSetSchema = z.object({
  v: z.literal(1),
  connection: slugIdSchema,
  base: z.string().min(1),
  ops: z.array(changeSetOpSchema),
})

export type ChangeSet = z.infer<typeof changeSetSchema>

/** FCP run/get_changes result (BL-048). */
export const runChangesResponseSchema = z.object({
  changeSet: changeSetSchema,
  previewMd: z.string(),
})

export type RunChangesResponse = z.infer<typeof runChangesResponseSchema>
