import { z } from "zod"
import { SkillSlug } from "../ids.ts"
import { defineMethod, defineNotification } from "./define.ts"

const DEFAULT_LIST_LIMIT_MAX = 500

export const skillScopeSchema = z.enum(["workspace", "home"])
export const skillDirSchema = z.enum([".agents", ".claude", ".cursor"])

export const skillFromSchema = z.object({
  sourceId: z.string().min(1),
  version: z.number().int().positive(),
})

/** List-row skill (no body; DES-040). */
export const skillSummarySchema = z.object({
  slug: SkillSlug,
  name: z.string().min(1),
  description: z.string(),
  scope: skillScopeSchema,
  dirs: z.array(skillDirSchema).min(1),
  from: skillFromSchema.optional(),
  problem: z.string().min(1).optional(),
})

export const skillDetailSchema = skillSummarySchema.extend({
  body: z.string(),
})

export type WireSkillSummary = z.infer<typeof skillSummarySchema>
export type WireSkillDetail = z.infer<typeof skillDetailSchema>

export const skillListParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(DEFAULT_LIST_LIMIT_MAX).optional(),
})

export const skillListResultSchema = z.object({
  items: z.array(skillSummarySchema),
  next: z.string().min(1).optional(),
})

export const skillGetParamsSchema = z.object({
  slug: SkillSlug,
  scope: skillScopeSchema,
})

export const skillGetResultSchema = skillDetailSchema

export const skillListMethod = defineMethod({
  name: "skill/list",
  params: skillListParamsSchema,
  result: skillListResultSchema,
  kind: "query",
})

export const skillGetMethod = defineMethod({
  name: "skill/get",
  params: skillGetParamsSchema,
  result: skillGetResultSchema,
  kind: "query",
})

const fcpRequestKeySchema = z.string().uuid().optional()

export const skillInstallParamsSchema = z.object({
  sourceId: z.string().min(1),
  slug: SkillSlug,
  version: z.number().int().positive(),
  requestKey: fcpRequestKeySchema,
})

export const skillInstallResultSchema = z.object({
  skill: skillDetailSchema,
})

export const skillUninstallParamsSchema = z.object({
  slug: SkillSlug,
  requestKey: fcpRequestKeySchema,
})

export const skillUninstallResultSchema = z.object({})

export const skillInstallMethod = defineMethod({
  name: "skill/install",
  params: skillInstallParamsSchema,
  result: skillInstallResultSchema,
  kind: "command",
})

export const skillUninstallMethod = defineMethod({
  name: "skill/uninstall",
  params: skillUninstallParamsSchema,
  result: skillUninstallResultSchema,
  kind: "command",
})

/** One skill offered by a Library source under `skills/` (DES-040). */
export const skillSourceOfferSchema = z.object({
  slug: SkillSlug,
  name: z.string().min(1),
  description: z.string(),
  body: z.string(),
})

export type WireSkillSourceOffer = z.infer<typeof skillSourceOfferSchema>

export const skillSourceSchema = z.object({
  id: z.string().min(1),
  skills: z.array(skillSourceOfferSchema),
})

export type WireSkillSource = z.infer<typeof skillSourceSchema>

export const skillListSourcesParamsSchema = z.object({})

export const skillListSourcesResultSchema = z.object({
  items: z.array(skillSourceSchema),
})

export const skillListSourcesMethod = defineMethod({
  name: "skill/list_sources",
  params: skillListSourcesParamsSchema,
  result: skillListSourcesResultSchema,
  kind: "query",
})

/** Replace the skill-source id list (Library item ids). */
export const skillSaveParamsSchema = z.object({
  sources: z.array(z.string().min(1)),
  requestKey: fcpRequestKeySchema,
})

export const skillSaveResultSchema = z.object({
  sources: z.array(z.string().min(1)),
})

export const skillSaveMethod = defineMethod({
  name: "skill/save",
  params: skillSaveParamsSchema,
  result: skillSaveResultSchema,
  kind: "command",
})

export const skillUpdateNotification = defineNotification({
  name: "skill/update",
  params: z.discriminatedUnion("kind", [
    z.object({
      seq: z.number().int().nonnegative(),
      kind: z.literal("skills_changed"),
    }),
  ]),
})
