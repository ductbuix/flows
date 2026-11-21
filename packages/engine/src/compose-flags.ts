import type { Effort } from "@workspace/shared"
import { shellSingleQuote } from "./agent-prompt.ts"
import { composeCursorModelId } from "./cursor-model-families.ts"

export type ComposeFlagsInput = {
  model?: string
  effort?: Effort
}

/** Claude argv for resolved model/effort (DES-023). */
export function composeClaudeFlags(input: ComposeFlagsInput): string[] {
  const flags: string[] = []
  if (input.model) flags.push("--model", input.model)
  if (input.effort) flags.push("--effort", input.effort)
  return flags
}

/**
 * Cursor argv: one `--model` with a composed family id (DES-023).
 * Bracket custom ids pass through. Prefer non-fast when listedIds known.
 */
export function composeCursorFlags(
  input: ComposeFlagsInput,
  listedIds: readonly string[] = []
): string[] {
  const model = input.model
  if (!model) return []
  if (model.includes("[")) return ["--model", model]
  return ["--model", composeCursorModelId(model, input.effort, listedIds)]
}

/** Embed composeFlags argv into a shell command string. */
export function flagsToShell(flags: string[]): string {
  if (flags.length === 0) return ""
  const parts: string[] = []
  for (let i = 0; i < flags.length; i++) {
    const token = flags[i]!
    if (token.startsWith("-") && !token.includes("=")) {
      parts.push(token)
    } else {
      parts.push(shellSingleQuote(token))
    }
  }
  return ` ${parts.join(" ")}`
}
