import type { CliTrustValue, TrustDecision } from "@workspace/shared"

/**
 * One policy for server (dialog) and engine (marker). Returns once,
 * always, or none from the home realpath, settings row, and run grant
 * (DES-019).
 */
export function decideTrust(options: {
  homeRealpath: string
  settings: CliTrustValue | null
  /** From run_started.trustGrant; only "once" is stored on the event. */
  runGrant?: "once" | undefined
}): TrustDecision {
  if (options.runGrant === "once") return "once"
  if (
    options.settings &&
    options.settings.homeRealpath === options.homeRealpath
  ) {
    return "always"
  }
  return "none"
}

/** True when always-trust is stored and still bound to this realpath. */
export function isAlwaysTrusted(
  homeRealpath: string,
  settings: CliTrustValue | null
): boolean {
  return decideTrust({ homeRealpath, settings }) === "always"
}
