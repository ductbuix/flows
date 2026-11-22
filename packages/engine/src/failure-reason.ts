import { getCliAdapter, type CliKind } from "./cli-adapters.ts"

export type { CliKind }

/** Map known CLI stderr patterns to a failure reason, else undefined. */
export function mapStderrReason(
  stderr: string,
  cli: CliKind | undefined
): string | undefined {
  if (!cli) return undefined
  for (const pattern of getCliAdapter(cli).failurePatterns) {
    if (stderr.includes(pattern)) return pattern
  }
  return undefined
}

/**
 * Prefer a mapped CLI reason; else `timeout` when the attempt timed out.
 */
export function resolveFinishReason(options: {
  stderr: string
  cli: CliKind | undefined
  timedOut: boolean
}): string | undefined {
  const mapped = mapStderrReason(options.stderr, options.cli)
  if (mapped) return mapped
  if (options.timedOut) return "timeout"
  return undefined
}
