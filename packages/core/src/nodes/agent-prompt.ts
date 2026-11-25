import type { ContentBlock } from "../ports/agent-runtime.ts"
import type { StepInput } from "./types.ts"

/** Profile id for the ACP session (Cursor first; BL-140). */
export function llmProfileId(cli: "claude" | "cursor"): string {
  return cli === "cursor" ? "cursor" : "cursor"
}

/** Prompt text: optional system, then prompt (DES-032 / DES-041). */
export function llmPromptText(parts: {
  system?: string
  prompt: string
}): string {
  const out: string[] = []
  const system = parts.system?.trim()
  if (system) out.push(system)
  out.push(parts.prompt.trim())
  return `${out.join("\n\n")}\n`
}

/** Store-free uri naming an input by the node that produced it. */
export function inputUri(input: Pick<StepInput, "from" | "name">): string {
  return input.from === "input"
    ? `flows://input/${input.name}`
    : `flows://nodes/${input.from}/${input.name}`
}

function inputLabel(input: StepInput, selfId?: string): string {
  if (input.from === "input") return "run input"
  if (input.role === "feedback") return `feedback from judge ${input.from}`
  if (input.from === selfId) return "your previous result"
  return `result of node ${input.from}`
}

/**
 * Prompt text, a list of the inputs, then one resource block per input
 * (DES-041). Inputs are upstream results only, attached here rather
 * than placed in the agent's working directory.
 */
export function llmContentBlocks(
  promptText: string,
  inputs: readonly StepInput[],
  selfId?: string
): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: "text", text: promptText }]
  const attached = inputs.filter((i) => i.text?.trim())
  if (attached.length === 0) return blocks
  const lines = attached.map(
    (i) => `- ${inputUri(i)}: ${inputLabel(i, selfId)}`
  )
  blocks.push({
    type: "text",
    text: `Inputs (attached below; they are not files in your working directory):\n${lines.join("\n")}\n`,
  })
  for (const input of attached) {
    blocks.push({
      type: "resource",
      uri: inputUri(input),
      mimeType: input.name.endsWith(".md") ? "text/markdown" : "text/plain",
      text: input.text ?? "",
    })
  }
  return blocks
}
