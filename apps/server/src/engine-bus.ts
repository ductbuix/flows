import type { EventBus, UpdateBus } from "@workspace/core"
import type { Engine } from "@workspace/engine"
import { publishRunFcpUpdates } from "./fcp-run-updates.ts"

/**
 * Bridges engine events into the FCP UpdateBus (run/update + step kinds)
 * and domain `run.finished` for Docket (BL-159).
 */
export function bindEngineToBus(
  engine: Engine,
  bus: UpdateBus,
  events: EventBus
): () => void {
  return engine.onEvent((stored) => {
    const runId = stored.event.runId
    const summary = engine.getRunSummary(runId)
    bus.publish("run/update", {
      kind: "run_changed",
      runId,
      summary,
    })
    publishRunFcpUpdates(engine, bus, events, stored, summary)
  })
}
