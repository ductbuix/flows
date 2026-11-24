import { z } from "zod"
import { defineMethod } from "./define.ts"

export const fcpClientInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
})

export const clientCapabilitiesSchema = z
  .object({
    host: z
      .object({
        revealPath: z.boolean().optional(),
        browserSignIn: z.boolean().optional(),
        notifications: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    updates: z
      .object({
        coalesced: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .default({})

export const agentInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  version: z.string().optional(),
})

export const engineCapabilitiesSchema = z.object({
  agents: z.array(agentInfoSchema),
  nodeKinds: z.array(z.string()),
  transports: z
    .object({
      connector: z.array(z.string()),
    })
    .optional(),
  blobs: z
    .object({
      http: z.string(),
    })
    .optional(),
})

export const fcpWorkspaceSchema = z.object({
  home: z.string(),
  id: z.string(),
})

export const initializeParamsSchema = z.object({
  protocolVersion: z.number().int().nonnegative(),
  clientInfo: fcpClientInfoSchema,
  clientCapabilities: clientCapabilitiesSchema,
})

export const initializeResultSchema = z.object({
  protocolVersion: z.number().int().positive(),
  engineInfo: fcpClientInfoSchema,
  engineCapabilities: engineCapabilitiesSchema,
  workspace: fcpWorkspaceSchema,
})

export const initializeMethod = defineMethod({
  name: "initialize",
  params: initializeParamsSchema,
  result: initializeResultSchema,
  kind: "query",
})
