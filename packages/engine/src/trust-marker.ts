import { getCliAdapter } from "./cli-adapters.ts"
import type { RunState } from "./nodes/run-state.ts"
import { decideTrust, isAlwaysTrusted } from "./trust-policy.ts"
import type { CliTrustValue } from "@workspace/contracts"

/**
 * True when a live run still needs the Cursor marker kept: always-trust
 * is valid, or the run received a trust-once grant (DES-019).
 */
export function runNeedsTrustMarker(
  state: RunState,
  homeRealpath: string,
  settings: CliTrustValue | null
): boolean {
  if (state.deleted) return false
  // Queued trust-once grants stay live for the marker (DES-021).
  if (state.status !== "running" && state.status !== "queued") return false
  if (isAlwaysTrusted(homeRealpath, settings)) return true
  return (
    decideTrust({
      homeRealpath,
      settings,
      runGrant: state.trustGrant,
    }) !== "none"
  )
}

export function anyLiveRunNeedsMarker(
  runs: RunState[],
  homeRealpath: string,
  settings: CliTrustValue | null
): boolean {
  return runs.some((r) => runNeedsTrustMarker(r, homeRealpath, settings))
}

/** Ensure Cursor marker exists after a grant (Claude is a no-op). */
export function prepareTrustMarker(
  homePath: string,
  workflowDir?: string
): void {
  getCliAdapter("cursor").prepareTrust(homePath, workflowDir)
}

/**
 * Keep or remove the marker from fold + settings (not an in-memory
 * refcount), so a restart cannot drop a live run's marker (DES-019).
 */
export function reconcileTrustMarker(options: {
  homeRealpath: string
  settings: CliTrustValue | null
  runs: RunState[]
  /** Workflow dirs for live granted runs (workflow-dir fallback). */
  workflowDirs?: string[]
}): void {
  const keep = anyLiveRunNeedsMarker(
    options.runs,
    options.homeRealpath,
    options.settings
  )
  const always = isAlwaysTrusted(options.homeRealpath, options.settings)
  const dirs = options.workflowDirs ?? []
  if (keep || always) {
    prepareTrustMarker(options.homeRealpath)
    for (const dir of dirs) prepareTrustMarker(options.homeRealpath, dir)
    return
  }
  getCliAdapter("cursor").cleanupTrust(options.homeRealpath)
  for (const dir of dirs) {
    getCliAdapter("cursor").cleanupTrust(options.homeRealpath, dir)
  }
}
