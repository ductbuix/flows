import type { Engine, RunState } from "@workspace/engine"

/** Waits until a run started through the API has ended, then returns its fold. */
export async function settle(
  engine: Engine,
  runId: string,
  ms = 20_000
): Promise<RunState> {
  const end = Date.now() + ms
  for (;;) {
    const state = engine.fold(runId)
    if (state && state.status !== "running" && state.status !== "queued") {
      return state
    }
    if (Date.now() > end) throw new Error(`run ${runId} did not end`)
    await new Promise((r) => setTimeout(r, 20))
  }
}
