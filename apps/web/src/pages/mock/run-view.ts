import type { FlowEdge, FlowNode, RunState } from "./flow-data"
import type { MockRun } from "./workflows-data"

/**
 * What each node did in a run (mock): the path the run took, how far it got,
 * and where it stopped. Nodes off the path are "skipped".
 */
export function nodeStatesFor(
  run: MockRun,
  nodes: FlowNode[],
  edges: FlowEdge[]
): Record<string, { state: RunState; result?: string }> {
  const branch = run.tone === "failed" && !run.decision ? "no" : "yes"
  const order: string[] = []
  // Starts: the trigger and fixed assets (assets with no inputs).
  const fed = new Set(edges.map((e) => e.target))
  const queue = nodes
    .filter((n) => n.type === "trigger" || (n.type === "asset" && !fed.has(n.id)))
    .map((n) => n.id)
  while (queue.length) {
    const cur = queue.shift()!
    if (order.includes(cur)) continue
    order.push(cur)
    const isCondition = nodes.find((n) => n.id === cur)?.type === "condition"
    for (const e of edges) {
      if (e.source !== cur) continue
      if (isCondition && e.sourceHandle !== branch) continue
      queue.push(e.target)
    }
  }
  const approval = order.findIndex((id) => nodes.find((n) => n.id === id)?.type === "approval")
  const atApproval = approval >= 0 && (run.tone === "attention" || !!run.decision)
  const reached = atApproval
    ? approval + (run.decision === "approved" ? 1 : 0)
    : run.tone === "done"
      ? order.length
      : Math.floor(order.length * (run.tone === "failed" ? 0.8 : 0.5))
  const stop: RunState =
    run.tone === "failed" ? "failed" : run.tone === "attention" ? "waiting" : "running"
  const out: Record<string, { state: RunState; result?: string }> = {}
  for (const n of nodes) {
    const i = order.indexOf(n.id)
    if (i < 0) out[n.id] = { state: "skipped" }
    else if (i < reached) {
      const kind = n.type
      out[n.id] = {
        state: "done",
        result:
          kind === "llm"
            ? `Mock output of attempt #${run.attempt}.`
            : kind === "condition"
              ? branch
              : undefined,
      }
    } else if (i === reached && run.tone !== "done")
      out[n.id] = {
        state: stop,
        result:
          stop === "failed"
            ? run.decision === "rejected"
              ? "Rejected by you."
              : "Stopped here: 2 of 14 tests are still failing."
            : undefined,
      }
  }
  return out
}
