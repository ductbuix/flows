import { z } from "zod"
import {
  connectionIdSchema,
  publishPolicySchema,
  refreshRuleSchema,
  signInMethodSchema,
} from "@workspace/contracts"

/**
 * Legacy connection instance shape used by in-repo engine connectors
 * (github/rally/…). Disk store removed in BL-213; callers pass values
 * in memory. BL-214 retires these adapters.
 */
export const connectionSchema = z.strictObject({
  id: connectionIdSchema,
  connector: z.string().min(1),
  name: z.string().min(1),
  scope: z.record(z.string(), z.string()).default({}),
  signIn: signInMethodSchema,
  refresh: refreshRuleSchema,
  policy: publishPolicySchema.default("read-only"),
  serial: z.boolean().default(false),
})

export type Connection = z.infer<typeof connectionSchema>
export type ConnectionInput = z.input<typeof connectionSchema>

/** Library / pin link on a run (DES-026). */
export type ResourceLink = {
  connection: string
  kind: string
  entityId: string
  title?: string
}
