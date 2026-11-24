import { z } from "zod"

/**
 * Folder-slug rule shared by workflow, connector, card and related ids
 * (DES-013 / DES-026 / DES-038). Branded copies for new signatures (DES-042 /
 * BL-112); existing unbranded schemas stay as they are.
 */
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const slugMessage = "lowercase letters, digits and dashes"

/** Unbranded slug id (connector file, library scope, node `connection`). */
export const slugIdSchema = z.string().min(1).regex(slugRegex, slugMessage)

/** Unbranded alias used by node `connection` fields and library pins. */
export const connectionIdSchema = slugIdSchema

export const CardId = z.string().regex(slugRegex, slugMessage).brand<"CardId">()
export type CardId = z.infer<typeof CardId>

export const RunId = z.string().regex(slugRegex, slugMessage).brand<"RunId">()
export type RunId = z.infer<typeof RunId>

export const WorkflowId = z
  .string()
  .regex(slugRegex, slugMessage)
  .brand<"WorkflowId">()
export type WorkflowId = z.infer<typeof WorkflowId>

export const StepId = z.string().regex(slugRegex, slugMessage).brand<"StepId">()
export type StepId = z.infer<typeof StepId>

export const ConnectorId = z
  .string()
  .regex(slugRegex, slugMessage)
  .brand<"ConnectorId">()
export type ConnectorId = z.infer<typeof ConnectorId>

export const SkillSlug = z
  .string()
  .regex(slugRegex, slugMessage)
  .brand<"SkillSlug">()
export type SkillSlug = z.infer<typeof SkillSlug>

export const LibItemId = z
  .string()
  .regex(slugRegex, slugMessage)
  .brand<"LibItemId">()
export type LibItemId = z.infer<typeof LibItemId>
