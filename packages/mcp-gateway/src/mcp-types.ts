import { z } from "zod"

/** MCP protocol version the gateway speaks. */
export const MCP_PROTOCOL_VERSION = "2024-11-05"

export const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

export const callToolResultSchema = z.object({
  content: z.array(textContentSchema).min(1),
  isError: z.boolean().optional(),
})

export type CallToolResult = z.infer<typeof callToolResultSchema>

export function asCallToolResult(value: unknown): CallToolResult {
  const parsed = callToolResultSchema.safeParse(value)
  if (parsed.success) return parsed.data
  return {
    content: [{ type: "text", text: JSON.stringify(value ?? null) }],
  }
}
