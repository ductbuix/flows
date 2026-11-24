import { z } from "zod"

/** One allowed MCP server (command or URL) in settings (DES-026 / BL-054). */
export const mcpTrustEntrySchema = z.object({
  key: z.string().min(1),
  trustedAt: z.string().min(1),
})

export type McpTrustEntry = z.infer<typeof mcpTrustEntrySchema>

/** Settings value: allowlisted MCP servers (DES-026 / BL-054). */
export const mcpTrustValueSchema = z.object({
  servers: z.array(mcpTrustEntrySchema),
})

export type McpTrustValue = z.infer<typeof mcpTrustValueSchema>

export const mcpTrustStatusSchema = z.object({
  servers: z.array(mcpTrustEntrySchema),
})

export type McpTrustStatus = z.infer<typeof mcpTrustStatusSchema>

export const putMcpTrustBodySchema = z.object({
  key: z.string().min(1),
  grant: z.enum(["once", "always", "none"]),
})

export type PutMcpTrustBody = z.infer<typeof putMcpTrustBodySchema>
