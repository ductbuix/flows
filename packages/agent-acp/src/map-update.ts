import { z } from "zod"
import type { AgentEvent, Logger, PlanEntry } from "@workspace/core"

const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

const planEntrySchema = z.object({
  content: z.string(),
  status: z.string().optional(),
  priority: z.string().optional(),
})

const moneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
})

const updateEnvelopeSchema = z.object({
  sessionId: z.string(),
  update: z
    .object({
      sessionUpdate: z.string(),
    })
    .passthrough(),
})

const stopReasonSchema = z.enum([
  "end_turn",
  "max_tokens",
  "max_turn_requests",
  "refusal",
  "cancelled",
])

export const promptResultSchema = z.object({
  stopReason: stopReasonSchema,
})

export type StopReason = z.infer<typeof stopReasonSchema>

function textFromContent(value: unknown): string | undefined {
  const parsed = textContentSchema.safeParse(value)
  return parsed.success ? parsed.data.text : undefined
}

function asPlanEntries(value: unknown): PlanEntry[] | undefined {
  const parsed = z.array(planEntrySchema).safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/**
 * Map one ACP `session/update` notification to an `AgentEvent`.
 * Unknown or malformed kinds return null; unknown kinds are logged.
 */
export function mapSessionUpdate(
  params: unknown,
  logger?: Logger
): AgentEvent | null {
  const envelope = updateEnvelopeSchema.safeParse(params)
  if (!envelope.success) {
    logger?.warn("ACP session/update missing sessionId or update", {
      params,
    })
    return null
  }

  const update = envelope.data.update
  const kind = update.sessionUpdate

  switch (kind) {
    case "agent_message_chunk": {
      const text = textFromContent(update.content)
      if (text === undefined) {
        logger?.warn("ACP agent_message_chunk without text content", {
          update,
        })
        return null
      }
      return { kind: "message_chunk", text }
    }
    case "agent_thought_chunk": {
      const text = textFromContent(update.content)
      if (text === undefined) {
        logger?.warn("ACP agent_thought_chunk without text content", {
          update,
        })
        return null
      }
      return { kind: "thought_chunk", text }
    }
    case "tool_call": {
      const id = typeof update.toolCallId === "string" ? update.toolCallId : ""
      const title = typeof update.title === "string" ? update.title : ""
      if (!id || !title) {
        logger?.warn("ACP tool_call missing toolCallId or title", { update })
        return null
      }
      return {
        kind: "tool_call",
        id,
        title,
        toolKind: typeof update.kind === "string" ? update.kind : "other",
        status: typeof update.status === "string" ? update.status : "pending",
        ...(update.rawInput !== undefined && update.rawInput !== null
          ? { input: update.rawInput }
          : {}),
      }
    }
    case "tool_call_update": {
      const id = typeof update.toolCallId === "string" ? update.toolCallId : ""
      if (!id) {
        logger?.warn("ACP tool_call_update missing toolCallId", { update })
        return null
      }
      const status =
        typeof update.status === "string" ? update.status : "pending"
      return {
        kind: "tool_call_update",
        id,
        status,
        ...(update.content !== undefined && update.content !== null
          ? { content: update.content }
          : {}),
        ...(update.rawInput !== undefined && update.rawInput !== null
          ? { input: update.rawInput }
          : {}),
      }
    }
    case "plan": {
      const entries = asPlanEntries(update.entries)
      if (!entries) {
        logger?.warn("ACP plan missing entries", { update })
        return null
      }
      return { kind: "plan", entries }
    }
    case "usage_update": {
      const used = update.used
      const size = update.size
      if (typeof used !== "number" || typeof size !== "number") {
        logger?.warn("ACP usage_update missing used or size", { update })
        return null
      }
      const costParsed = moneySchema.safeParse(update.cost)
      if (costParsed.success) {
        return { kind: "usage", used, size, cost: costParsed.data }
      }
      return { kind: "usage", used, size }
    }
    default:
      logger?.warn("ignoring unknown ACP session update kind", {
        sessionUpdate: kind,
      })
      return null
  }
}

export function parseStopReason(result: unknown): StopReason {
  const parsed = promptResultSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error("session/prompt result missing stopReason")
  }
  return parsed.data.stopReason
}
