import { z } from "zod"
import { cardIdSchema } from "./docket/schemas.ts"

/** Trust grant on start / always-trust store (DES-019). */
export const trustGrantSchema = z.enum(["once", "always"])
export type TrustGrant = z.infer<typeof trustGrantSchema>

/** Always-trust settings row in app.db (DES-019). */
export const cliTrustValueSchema = z.object({
  homeRealpath: z.string().min(1),
  trustedAt: z.string().min(1),
})
export type CliTrustValue = z.infer<typeof cliTrustValueSchema>

export const trustDecisionSchema = z.enum(["once", "always", "none"])
export type TrustDecision = z.infer<typeof trustDecisionSchema>

export const startRunBodySchema = z.object({
  requestId: z.string().min(1),
  trustGrant: trustGrantSchema.optional(),
  /** Declared input field values (DES-021). */
  values: z.record(z.string(), z.string()).optional(),
  /** Start anyway when an item key already exists (DES-021). */
  confirmDuplicate: z.boolean().optional(),
  /** Rerun: pull and pin again instead of reusing prior pins (BL-043). */
  refreshPins: z.boolean().optional(),
  /** Optional docket card; unknown id is 400 unknown_card (BL-039). */
  cardId: cardIdSchema.optional(),
  /** Node run: run only this node on the latest upstream results (BL-102). */
  only: z.string().min(1).optional(),
  /** Node run: run from this node, reusing unchanged earlier steps (BL-102). */
  from: z.string().min(1).optional(),
  /** Node run: the earlier run to reuse; default is the latest (BL-102). */
  baseRunId: z.string().min(1).optional(),
})

export type StartRunBody = z.infer<typeof startRunBodySchema>

export const invalidInputErrorSchema = z.object({
  error: z.literal("invalid_input"),
  fields: z.record(z.string(), z.string()),
})

export type InvalidInputError = z.infer<typeof invalidInputErrorSchema>

export const duplicateInputErrorSchema = z.object({
  error: z.literal("duplicate_input"),
  itemKey: z.string().min(1),
  existingRunIds: z.array(z.string().min(1)).min(1),
})

export type DuplicateInputError = z.infer<typeof duplicateInputErrorSchema>

export const unknownCardErrorSchema = z.object({
  error: z.literal("unknown_card"),
  cardId: z.string().min(1),
})

export type UnknownCardError = z.infer<typeof unknownCardErrorSchema>

export const trustCheckStatusSchema = z.enum(["pass", "warn"])
export type TrustCheckStatus = z.infer<typeof trustCheckStatusSchema>

export const trustCheckSchema = z.object({
  id: z.string().min(1),
  status: trustCheckStatusSchema,
  message: z.string().min(1),
})

export type TrustCheck = z.infer<typeof trustCheckSchema>

export const trustStatusSchema = z.object({
  trust: trustDecisionSchema,
  homeRealpath: z.string().min(1),
  alwaysTrusted: z.boolean(),
})

export type TrustStatus = z.infer<typeof trustStatusSchema>

export const putTrustBodySchema = z.object({
  grant: z.enum(["always", "none"]),
})

export type PutTrustBody = z.infer<typeof putTrustBodySchema>

export const preflightResponseSchema = z.object({
  trust: trustDecisionSchema,
  checks: z.array(trustCheckSchema),
  needsAgentCli: z.boolean(),
  /** Agent CLIs the run may launch, for the Allow dialog title. */
  clis: z.array(z.enum(["claude", "cursor"])).default([]),
})

export type PreflightResponse = z.infer<typeof preflightResponseSchema>

export const trustRequiredErrorSchema = z.object({
  error: z.literal("trust_required"),
  message: z.string().min(1),
  trust: z.literal("none"),
  checks: z.array(trustCheckSchema),
})

export type TrustRequiredError = z.infer<typeof trustRequiredErrorSchema>

/** Read-only agent CLI probe for Settings (DES-024). */
export const cliInfoSchema = z.object({
  id: z.enum(["claude", "cursor"]),
  installed: z.boolean(),
  version: z.string().nullable(),
})

export type CliInfo = z.infer<typeof cliInfoSchema>

export const cliStatusSchema = z.object({
  clis: z.array(cliInfoSchema),
})

export type CliStatus = z.infer<typeof cliStatusSchema>
