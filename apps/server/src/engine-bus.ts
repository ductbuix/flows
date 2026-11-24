import type { UpdateBus } from "@workspace/core"
import type { Engine } from "@workspace/engine"
import { publishRunFcpUpdates } from "./fcp-run-updates.ts"

/**
 * Bridges engine events into the FCP UpdateBus (run/update + step kinds).
 * Replaces the REST WsHub fan-out; subscriptions stay on the FCP peer.
 */
export function bindEngineToBus(engine: Engine, bus: UpdateBus): () => void {
  return engine.onEvent((stored) => {
    const runId = stored.event.runId
    const summary = engine.getRunSummary(runId)
    bus.publish("run/update", {
      kind: "run_changed",
      runId,
      summary,
    })
    publishRunFcpUpdates(engine, bus, stored, summary)
  })
}
