import type {
  CliTrustValue,
  TrustDecision,
  TrustGrant,
} from "@workspace/shared"
import type { RunState } from "./fold.ts"
import { workflowDir } from "./paths.ts"
import { isAlwaysTrusted } from "./trust-policy.ts"
import {
  prepareTrustMarker,
  reconcileTrustMarker as reconcileMarker,
} from "./trust-marker.ts"
import { decideTrust } from "./trust-policy.ts"

/** Apply start-body trustGrant or require an existing always-trust. */
export function applyStartTrustGrant(
  grant: TrustGrant | undefined,
  homeRealpath: string,
  settings: CliTrustValue | null,
  setAlways: (value: CliTrustValue) => void
): void {
  if (grant === "always") {
    setAlways({
      homeRealpath,
      trustedAt: new Date().toISOString(),
    })
    return
  }
  if (grant === "once") return
  if (isAlwaysTrusted(homeRealpath, settings)) return
  throw new Error("trust_required")
}

export function reconcileEngineTrustMarker(options: {
  home: string
  homeRealpath: string
  settings: CliTrustValue | null
  runs: RunState[]
}): void {
  const workflowDirs = [
    ...new Set(
      options.runs
        .filter(
          (r) =>
            r.trustGrant === "once" ||
            (r.status === "running" &&
              isAlwaysTrusted(options.homeRealpath, options.settings))
        )
        .map((r) => workflowDir(options.home, r.workflowId))
    ),
  ]
  reconcileMarker({
    homeRealpath: options.homeRealpath,
    settings: options.settings,
    runs: options.runs,
    workflowDirs,
  })
}

export function trustDecisionFor(
  homeRealpath: string,
  settings: CliTrustValue | null
): TrustDecision {
  return decideTrust({ homeRealpath, settings })
}

export { prepareTrustMarker }
