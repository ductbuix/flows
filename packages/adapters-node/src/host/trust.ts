import type { CliTrustValue, TrustDecision } from "@workspace/contracts"
import {
  prepareTrustMarker,
  reconcileEngineTrustMarker,
  trustDecisionFor,
} from "./engine-trust.ts"
import type { EventLog } from "./event-log.ts"
import { listLoggedRuns } from "./log-runs.ts"
import { resolveAppHomeRealpath } from "./paths.ts"

export function getCliTrust(log: EventLog): CliTrustValue | null {
  return log.getCliTrust()
}

export function trustDecision(log: EventLog, home: string): TrustDecision {
  return trustDecisionFor(resolveAppHomeRealpath(home), log.getCliTrust())
}

export function setAlwaysTrust(log: EventLog, home: string): void {
  log.setCliTrust({
    homeRealpath: resolveAppHomeRealpath(home),
    trustedAt: new Date().toISOString(),
  })
  prepareTrustMarker(resolveAppHomeRealpath(home))
}

export function revokeAlwaysTrust(log: EventLog, home: string): void {
  log.clearCliTrust()
  reconcileTrustMarker(log, home)
}

export function reconcileTrustMarker(log: EventLog, home: string): void {
  reconcileEngineTrustMarker({
    home,
    homeRealpath: resolveAppHomeRealpath(home),
    settings: log.getCliTrust(),
    runs: listLoggedRuns(log),
  })
}
