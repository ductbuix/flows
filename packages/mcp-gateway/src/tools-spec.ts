import { z } from "zod"

/** One MCP tool the gateway will advertise (from the launch JSON). */
export const toolSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).default({ type: "object" }),
})

export const toolsSpecSchema = z.object({
  tools: z.array(toolSpecSchema),
})

export type ToolSpec = z.infer<typeof toolSpecSchema>
export type ToolsSpec = z.infer<typeof toolsSpecSchema>

export function parseToolsSpec(input: unknown): ToolsSpec {
  return toolsSpecSchema.parse(input)
}
